"""Convert the dataset (folder -> documents) into single-table entities (spec §5.5)."""

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any, Literal

from ..entities import (
    Achievement,
    Animal,
    BaseModel,
    Building,
    Bundle,
    BundleRequirement,
    Category,
    Collection,
    CropAttribute,
    Festival,
    ForagingEvent,
    FruitTreeAttribute,
    GameMeta,
    GiftTaste,
    Ingredient,
    Item,
    LocalizedText,
    Member,
    MonsterGoal,
    Movie,
    MovieTaste,
    Perfection,
    Produces,
    Recipe,
    Reminder,
    Shop,
    ShopOffer,
    UniversalGifts,
    Villager,
)
from ..entities.keys import ITEM_FOLDERS
from ..entities.relations import UNIVERSAL_GIFTS_PK

GIFT_TIERS = ("loves", "likes", "neutral", "dislikesOrHates")
OFFER_FIELDS = {
    "price": "price",
    "priceByYear": "price_by_year",
    "currency": "currency",
    "materials": "materials",
    "season": "season",
    "section": "section",
    "availability": "availability",
    "fromYear": "from_year",
    "fishingLevel": "fishing_level",
    "packSize": "pack_size",
    "recipe": "recipe",
    "rotating": "rotating",
    "requiresBuilding": "requires_building",
    "requiresMonsterGoal": "requires_monster_goal",
    "special": "special",
}


@dataclass
class ConversionResult:
    models: list[BaseModel] = field(default_factory=list)
    diffs: list[str] = field(default_factory=list)


def localize(value: Any) -> Any:
    """Recursively rename the `pt-BR` locale key to `ptBr` (camelCase attribute rule)."""
    if isinstance(value, dict):
        return {("ptBr" if key == "pt-BR" else key): localize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [localize(item) for item in value]
    return value


def text(value: dict | None) -> LocalizedText | None:
    if not value:
        return None
    return LocalizedText(en=value.get("en"), pt_br=value.get("pt-BR"))


def common(doc: dict) -> dict[str, Any]:
    return {"entity_id": doc["id"], "name": text(doc.get("name")), "name_verified": doc.get("nameVerified")}


class _Builder:
    def __init__(self) -> None:
        self.result = ConversionResult()
        self._keys: set[tuple[str, str]] = set()

    def add(self, model: BaseModel) -> None:
        key = (model.pk, model.sk)
        if key in self._keys:
            self.result.diffs.append(f"duplicate key skipped: {key[0]} {key[1]}")
            return
        self._keys.add(key)
        self.result.models.append(model)

    def add_all(self, models: Iterable[BaseModel]) -> None:
        for model in models:
            self.add(model)


def _recipe(builder: _Builder, result_id: str, kind: Literal["crafting", "cooking"], recipe: dict | None) -> None:
    if not recipe:
        return
    builder.add(
        Recipe.build(
            result_id,
            kind,
            ingredients=localize(recipe.get("ingredients")),
            alternatives=localize(recipe.get("alternatives")),
            note=recipe.get("note"),
        )
    )
    entries = list(recipe.get("ingredients") or [])
    for alternative in recipe.get("alternatives") or []:
        entries.extend(alternative.get("ingredients") or [])
    for entry in entries:
        for item_id in [entry["item"]] if entry.get("item") else entry.get("anyOf") or []:
            builder.add(Ingredient.build(result_id, kind, item_id, entry.get("qty")))


def _item(builder: _Builder, folder: str, doc: dict) -> None:
    crop = doc.get("crop")
    tree = doc.get("fruitTree")
    builder.add(
        Item.build(
            **common(doc),
            item_type=folder,
            subtype=doc.get("subtype"),
            tags=doc.get("tags"),
            sell_price=doc.get("sellPrice"),
            museum_donation=doc.get("museumDonation"),
            artisan=doc.get("artisan") or None,
            average_forage_value=doc.get("averageForageValue"),
            crop=CropAttribute(
                seasons=crop["seasons"],
                growth_days=crop["growthDays"],
                phases=crop.get("phases"),
                regrow_days=crop.get("regrowDays"),
                last_planting_day=crop.get("lastPlantingDay"),
                average_extra_yield=crop.get("averageExtraYield"),
                produce=crop.get("produce"),
                notes=crop.get("notes"),
            )
            if crop
            else None,
            fruit_tree=FruitTreeAttribute(
                fruit=tree["fruit"],
                season=tree["season"],
                days_to_mature=tree["daysToMature"],
                fruits_per_day=tree.get("fruitsPerDay"),
                max_fruit_on_tree=tree.get("maxFruitOnTree"),
            )
            if tree
            else None,
            catch=localize(doc.get("catch")),
            processing=localize(doc.get("processing")),
            machine_category=doc.get("category") if folder == "maquinas" else None,
        )
    )
    _recipe(builder, doc["id"], "crafting", doc.get("craftingRecipe"))
    _recipe(builder, doc["id"], "cooking", doc.get("cookingRecipe"))
    if crop and crop.get("produce"):
        builder.add(Produces.build(doc["id"], crop["produce"], via="crop", days=None))
    if tree:
        builder.add(Produces.build(doc["id"], tree["fruit"], via="fruit_tree", days=tree["daysToMature"]))
    for step in doc.get("processing") or []:
        builder.add(Produces.build(doc["id"], step["output"], via="machine", days=step.get("days")))


def _gift_tastes(owner_pk: str, gifts: dict) -> list[GiftTaste]:
    tastes = []
    for tier in GIFT_TIERS:
        for entry in gifts.get(tier) or []:
            if isinstance(entry, str):
                entry = {"item": entry}
            kind, target = ("ITEM", entry["item"]) if entry.get("item") else ("CATEGORY", entry["category"])
            tastes.append(GiftTaste.build(owner_pk, tier, kind, target, entry.get("except")))  # type: ignore[arg-type]
    return tastes


def _villager(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(Villager.build(**common(doc), birthday=doc.get("birthday"), marriageable=doc.get("marriageable")))
    builder.add_all(_gift_tastes(f"VILLAGER#{doc['id']}", doc.get("gifts") or {}))
    theater = doc.get("movieTheater") or {}
    for level in ("loved", "liked"):
        for movie in theater.get(f"{level}Movies") or []:
            builder.add(MovieTaste.build(doc["id"], level, "MOVIE", movie))  # type: ignore[arg-type]
        for snack in theater.get(f"{level}Snacks") or []:
            builder.add(MovieTaste.build(doc["id"], level, "ITEM", snack))  # type: ignore[arg-type]


def _universal_gifts(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(
        UniversalGifts.build(description=text(doc.get("description")), tier_labels=localize(doc.get("tierLabels")))
    )
    builder.add_all(_gift_tastes(UNIVERSAL_GIFTS_PK, doc))


def _offer_fields(offer: dict) -> dict[str, Any]:
    return {target: localize(offer[source]) for source, target in OFFER_FIELDS.items() if source in offer}


def _shop(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(
        Shop.build(
            **common(doc),
            schedule=localize(doc.get("schedule")),
            schedule_text=localize(doc.get("scheduleText")),
            schedule_text_verified=doc.get("scheduleTextVerified"),
            access=localize(doc.get("access")),
        )
    )
    for index, offer in enumerate(doc.get("offers") or []):
        builder.add(ShopOffer.build(doc["id"], offer["item"], index, **_offer_fields(offer)))


def _members(
    builder: _Builder, owner_kind: Literal["CATEGORY", "COLLECTION"], owner_id: str, item_ids: Iterable[str]
) -> None:
    for item_id in item_ids:
        builder.add(Member.build(owner_kind, owner_id, item_id))


def _category(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(Category.build(**common(doc), note=doc.get("note")))
    _members(builder, "CATEGORY", doc["id"], doc.get("members") or [])


def _collection(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(Collection.build(**common(doc)))
    _members(builder, "COLLECTION", doc["id"], [*(doc.get("artifacts") or []), *(doc.get("minerals") or [])])


def _bundle(builder: _Builder, _folder: str, doc: dict) -> None:
    builder.add(
        Bundle.build(
            **common(doc),
            room=localize(doc.get("room")),
            quality=doc.get("quality"),
            remixed=doc.get("remixed"),
            slots_required=doc.get("slotsRequired"),
        )
    )
    for index, entry in enumerate(doc.get("items") or []):
        builder.add(
            BundleRequirement.build(
                doc["id"],
                index,
                entry.get("item"),
                qty=entry.get("qty"),
                gold=entry.get("gold"),
                rain_only=entry.get("rainOnly"),
                seasons=entry.get("seasons"),
            )
        )


def _simple(factory: Callable[[dict], BaseModel]) -> Callable[[_Builder, str, dict], None]:
    def convert(builder: _Builder, _folder: str, doc: dict) -> None:
        builder.add(factory(doc))

    return convert


CONVERTERS: dict[str, Callable[[_Builder, str, dict], None]] = {
    "personagens": _villager,
    "presentes": _universal_gifts,
    "lojas": _shop,
    "categorias": _category,
    "colecoes": _collection,
    "pacotes": _bundle,
    "construcoes": _simple(
        lambda d: Building.build(
            **common(d),
            category=d.get("category"),
            price=(d.get("construction") or {}).get("price"),
            build_days=(d.get("construction") or {}).get("buildDays"),
            built_by=(d.get("construction") or {}).get("builtBy"),
            upgrade_from=(d.get("construction") or {}).get("upgradeFrom"),
            materials=(d.get("construction") or {}).get("materials"),
        )
    ),
    "animais": _simple(lambda d: Animal.build(**common(d), housing=d.get("housing"), purchase=d.get("purchase"))),
    "festivais": _simple(
        lambda d: Festival.build(
            **common(d),
            season=d["season"],
            start_day=d["startDay"],
            end_day=d["endDay"],
            shops_closed=d.get("shopsClosed"),
        )
    ),
    "eventos-coleta": _simple(
        lambda d: ForagingEvent.build(
            **common(d), season=d["season"], start_day=d["startDay"], end_day=d["endDay"], item=d.get("item")
        )
    ),
    "filmes": _simple(lambda d: Movie.build(**common(d))),
    "conquistas": _simple(
        lambda d: Achievement.build(**common(d), description=text(d.get("description")), order=d.get("order"))
    ),
    "metas-monstros": _simple(
        lambda d: MonsterGoal.build(
            **common(d), kills_required=d.get("killsRequired"), location=d.get("location"), reward=d.get("reward")
        )
    ),
    "lembretes": _simple(
        lambda d: Reminder.build(
            **common(d),
            detail=text(d.get("detail")),
            trigger=d.get("trigger"),
            night_market_daily=d.get("nightMarketDaily"),
            suppress_on_festival=d.get("suppressOnFestival"),
            order=d.get("order"),
        )
    ),
    "perfeicao": _simple(lambda d: Perfection.build(**common(d), categories=localize(d.get("categories")))),
    "_meta": _simple(
        lambda d: GameMeta.build(entity_id=d["id"], payload=localize({k: v for k, v in d.items() if k != "id"}))
    ),
}


def _mirror_diffs(builder: _Builder, dataset: dict[str, list[dict]]) -> None:
    """Item-side giftTastes/soldAt mirror villager gifts / shop offers; only the owner side is stored."""
    villager_gifts = {
        (m.sk.split("#", 3)[3], m.tier, m.pk.removeprefix("VILLAGER#"))
        for m in builder.result.models
        if isinstance(m, GiftTaste) and m.pk.startswith("VILLAGER#") and "#ITEM#" in m.sk
    }
    offers = {(m.shop_id, m.item_id) for m in builder.result.models if isinstance(m, ShopOffer)}
    next_index: dict[str, int] = {}
    for m in builder.result.models:
        if isinstance(m, ShopOffer):
            next_index[m.shop_id] = max(next_index.get(m.shop_id, 0), int(m.sk.rsplit("#", 1)[1]) + 1)

    for folder in sorted(ITEM_FOLDERS & dataset.keys()):
        for doc in dataset[folder]:
            for tier, villagers in (doc.get("giftTastes") or {}).items():
                for villager in villagers:
                    if (doc["id"], tier, villager) not in villager_gifts:
                        builder.result.diffs.append(f"gift mismatch: {doc['id']} {tier} {villager}")
            for sold in doc.get("soldAt") or []:
                shop = sold["shop"]
                if (shop, doc["id"]) in offers:
                    continue
                builder.result.diffs.append(f"soldAt without shop offer: {doc['id']} @ {shop}")
                index = next_index.get(shop, 0)
                next_index[shop] = index + 1
                offers.add((shop, doc["id"]))
                builder.add(ShopOffer.build(shop, doc["id"], index, **_offer_fields(sold)))


def convert_dataset(dataset: dict[str, list[dict]]) -> ConversionResult:
    builder = _Builder()
    for folder in sorted(dataset):
        converter = _item if folder in ITEM_FOLDERS else CONVERTERS.get(folder)
        if converter is None:
            builder.result.diffs.append(f"unknown folder skipped: {folder}")
            continue
        for doc in dataset[folder]:
            converter(builder, folder, doc)
    _mirror_diffs(builder, dataset)
    return builder.result
