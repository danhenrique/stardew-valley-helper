"""Read access to the game entities and their plain (camelCase) attributes."""

from collections.abc import Iterable
from typing import Any

from pynamodb.attributes import MapAttribute
from stardew_valley_db.entities import BaseModel, GameEntity, Item
from stardew_valley_db.entities.keys import ITEM_FOLDERS

from .models import LocalizedTextOut

KEY_ATTRIBUTES = {"pk", "sk", "gsi1pk", "gsi1sk", "entity_type"}
COMMON_ATTRIBUTES = {"entity_id", "name", "name_verified", "item_type"}

# Non-item folders exposed by /game/{type}: folder -> (pk prefix, sk)
ENTITY_FOLDERS: dict[str, tuple[str, str]] = {
    "personagens": ("VILLAGER", "VILLAGER"),
    "lojas": ("SHOP", "SHOP"),
    "construcoes": ("BUILDING", "BUILDING"),
    "animais": ("ANIMAL", "ANIMAL"),
    "festivais": ("FESTIVAL", "FESTIVAL"),
    "pacotes": ("BUNDLE", "BUNDLE"),
    "categorias": ("CATEGORY", "CATEGORY"),
    "filmes": ("MOVIE", "MOVIE"),
    "conquistas": ("ACHIEVEMENT", "ACHIEVEMENT"),
    "metas-monstros": ("MONSTER_GOAL", "MONSTER_GOAL"),
    "colecoes": ("COLLECTION", "COLLECTION"),
    "perfeicao": ("PERFECTION", "PERFECTION"),
    "eventos-coleta": ("FORAGING_EVENT", "FORAGING_EVENT"),
    "lembretes": ("REMINDER", "REMINDER"),
}


def is_known_folder(folder: str) -> bool:
    return folder in ITEM_FOLDERS or folder in ENTITY_FOLDERS


def entity_key(folder: str, entity_id: str) -> tuple[str, str]:
    prefix, sk = ("ITEM", "ITEM") if folder in ITEM_FOLDERS else ENTITY_FOLDERS[folder]
    return f"{prefix}#{entity_id}", sk


def to_plain(value: Any) -> Any:
    if isinstance(value, MapAttribute):
        attributes = value.get_attributes()
        if attributes:  # typed map: expose stored (camelCase) names
            return {
                attr.attr_name: to_plain(getattr(value, name))
                for name, attr in attributes.items()
                if getattr(value, name) is not None
            }
        return to_plain(value.as_dict())
    if isinstance(value, dict):
        return {key: to_plain(item) for key, item in value.items()}
    if isinstance(value, (list, set, tuple)):
        return [to_plain(item) for item in value]
    return value


def plain_attributes(model: BaseModel, exclude: Iterable[str] = ()) -> dict[str, Any]:
    skip = set(exclude)
    return {
        attr.attr_name: to_plain(getattr(model, name))
        for name, attr in model.get_attributes().items()
        if name not in skip and getattr(model, name) is not None
    }


def folder_of(model: GameEntity) -> str:
    return model.item_type if isinstance(model, Item) else model.FOLDER or ""


def list_folder(folder: str) -> list[GameEntity]:
    return [m for m in BaseModel.gsi1_index.query(f"TYPE#{folder}") if isinstance(m, GameEntity)]


def localized_name(model: GameEntity) -> LocalizedTextOut | None:
    name = to_plain(model.name) if model.name else None
    return LocalizedTextOut(en=name.get("en"), pt_br=name.get("ptBr")) if name else None
