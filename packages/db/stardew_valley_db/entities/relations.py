"""Relationship items (spec §5.2): children under the owner's pk, inverted on gsi2."""

from typing import Any, Literal, Self

from pynamodb.attributes import BooleanAttribute, ListAttribute, MapAttribute, NumberAttribute, UnicodeAttribute

from .base import BaseModel

GiftTier = Literal["loves", "likes", "neutral", "dislikesOrHates"]
UNIVERSAL_GIFTS_PK = "UNIVERSAL_GIFTS"


class GiftTaste(BaseModel, discriminator="GiftTaste"):
    tier = UnicodeAttribute()
    except_ids = ListAttribute(of=UnicodeAttribute, null=True, attr_name="except")

    @classmethod
    def build(
        cls,
        owner_pk: str,
        tier: GiftTier,
        target_kind: Literal["ITEM", "CATEGORY"],
        target_id: str,
        except_ids: list[str] | None,
    ) -> Self:
        owner = "UNIVERSAL" if owner_pk == UNIVERSAL_GIFTS_PK else owner_pk
        return cls(
            pk=owner_pk,
            sk=f"GIFT#{tier}#{target_kind}#{target_id}",
            gsi2pk=f"{target_kind}#{target_id}",
            gsi2sk=f"GIFT#{tier}#{owner}",
            tier=tier,
            except_ids=except_ids or None,
        )


class MovieTaste(BaseModel, discriminator="MovieTaste"):
    level = UnicodeAttribute()

    @classmethod
    def build(
        cls, villager_id: str, level: Literal["loved", "liked"], target_kind: Literal["MOVIE", "ITEM"], target_id: str
    ) -> Self:
        return cls(
            pk=f"VILLAGER#{villager_id}",
            sk=f"MOVIE_TASTE#{level}#{target_kind}#{target_id}",
            gsi2pk=f"{target_kind}#{target_id}",
            gsi2sk=f"MOVIE_TASTE#{level}#VILLAGER#{villager_id}",
            level=level,
        )


class ShopOffer(BaseModel, discriminator="ShopOffer"):
    shop_id = UnicodeAttribute(attr_name="shopId")
    item_id = UnicodeAttribute(attr_name="itemId")
    price = NumberAttribute(null=True)
    price_by_year = MapAttribute(null=True, attr_name="priceByYear")
    currency = MapAttribute(null=True)
    materials = ListAttribute(null=True)
    season = UnicodeAttribute(null=True)
    section = UnicodeAttribute(null=True)
    availability = UnicodeAttribute(null=True)
    from_year = NumberAttribute(null=True, attr_name="fromYear")
    fishing_level = NumberAttribute(null=True, attr_name="fishingLevel")
    pack_size = NumberAttribute(null=True, attr_name="packSize")
    recipe = BooleanAttribute(null=True)
    rotating = BooleanAttribute(null=True)
    requires_building = UnicodeAttribute(null=True, attr_name="requiresBuilding")
    requires_monster_goal = UnicodeAttribute(null=True, attr_name="requiresMonsterGoal")
    special = UnicodeAttribute(null=True)

    @classmethod
    def build(cls, shop_id: str, item_id: str, index: int, **offer_fields: Any) -> Self:
        return cls(
            pk=f"SHOP#{shop_id}",
            sk=f"OFFER#ITEM#{item_id}#{index:02d}",
            gsi2pk=f"ITEM#{item_id}",
            gsi2sk=f"OFFER#SHOP#{shop_id}#{index:02d}",
            shop_id=shop_id,
            item_id=item_id,
            **offer_fields,
        )


class Recipe(BaseModel, discriminator="Recipe"):
    kind = UnicodeAttribute()
    ingredients = ListAttribute(null=True)
    alternatives = ListAttribute(null=True)
    note = UnicodeAttribute(null=True)

    @classmethod
    def build(
        cls,
        result_id: str,
        kind: Literal["crafting", "cooking"],
        ingredients: list | None,
        alternatives: list | None = None,
        note: str | None = None,
    ) -> Self:
        return cls(
            pk=f"ITEM#{result_id}",
            sk=f"RECIPE#{kind}",
            kind=kind,
            ingredients=ingredients,
            alternatives=alternatives,
            note=note,
        )


class Ingredient(BaseModel, discriminator="Ingredient"):
    qty = NumberAttribute(null=True)
    recipe_kind = UnicodeAttribute(attr_name="recipeKind")

    @classmethod
    def build(cls, result_id: str, kind: str, item_id: str, qty: int | None) -> Self:
        return cls(
            pk=f"ITEM#{result_id}",
            sk=f"INGREDIENT#{kind}#ITEM#{item_id}",
            gsi2pk=f"ITEM#{item_id}",
            gsi2sk=f"USED_IN#ITEM#{result_id}",
            qty=qty,
            recipe_kind=kind,
        )


class Produces(BaseModel, discriminator="Produces"):
    via = UnicodeAttribute()
    days = NumberAttribute(null=True)

    @classmethod
    def build(
        cls, origin_id: str, product_id: str, via: Literal["crop", "fruit_tree", "machine"], days: int | None
    ) -> Self:
        return cls(
            pk=f"ITEM#{origin_id}",
            sk=f"PRODUCES#ITEM#{product_id}",
            gsi2pk=f"ITEM#{product_id}",
            gsi2sk=f"PRODUCED_BY#ITEM#{origin_id}",
            via=via,
            days=days,
        )


class Member(BaseModel, discriminator="Member"):
    @classmethod
    def build(cls, owner_kind: Literal["CATEGORY", "COLLECTION"], owner_id: str, item_id: str) -> Self:
        return cls(
            pk=f"{owner_kind}#{owner_id}",
            sk=f"MEMBER#ITEM#{item_id}",
            gsi2pk=f"ITEM#{item_id}",
            gsi2sk=f"MEMBER_OF#{owner_kind}#{owner_id}",
        )


class BundleRequirement(BaseModel, discriminator="BundleRequirement"):
    qty = NumberAttribute(null=True)
    gold = NumberAttribute(null=True)
    rain_only = BooleanAttribute(null=True, attr_name="rainOnly")
    seasons = ListAttribute(of=UnicodeAttribute, null=True)

    @classmethod
    def build(
        cls,
        bundle_id: str,
        index: int,
        item_id: str | None,
        qty: int | None = None,
        gold: int | None = None,
        rain_only: bool | None = None,
        seasons: list[str] | None = None,
    ) -> Self:
        target = f"ITEM#{item_id}" if item_id else "GOLD"
        return cls(
            pk=f"BUNDLE#{bundle_id}",
            sk=f"REQUIRES#{index:02d}#{target}",
            gsi2pk=f"ITEM#{item_id}" if item_id else None,
            gsi2sk=f"IN_BUNDLE#{bundle_id}" if item_id else None,
            qty=qty,
            gold=gold,
            rain_only=rain_only,
            seasons=seasons,
        )
