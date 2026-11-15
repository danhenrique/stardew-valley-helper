"""Typed map attributes. Python names are snake_case; stored names are camelCase."""

from pynamodb.attributes import ListAttribute, MapAttribute, NumberAttribute, UnicodeAttribute


class LocalizedText(MapAttribute):
    en = UnicodeAttribute(null=True)
    pt_br = UnicodeAttribute(null=True, attr_name="ptBr")


class CropAttribute(MapAttribute):
    seasons = ListAttribute(of=UnicodeAttribute)
    growth_days = NumberAttribute(attr_name="growthDays")
    phases = ListAttribute(of=NumberAttribute, null=True)
    regrow_days = NumberAttribute(null=True, attr_name="regrowDays")
    last_planting_day = NumberAttribute(null=True, attr_name="lastPlantingDay")
    average_extra_yield = NumberAttribute(null=True, attr_name="averageExtraYield")
    produce = UnicodeAttribute(null=True)
    notes = ListAttribute(of=UnicodeAttribute, null=True)


class FruitTreeAttribute(MapAttribute):
    fruit = UnicodeAttribute()
    season = UnicodeAttribute()
    days_to_mature = NumberAttribute(attr_name="daysToMature")
    fruits_per_day = NumberAttribute(null=True, attr_name="fruitsPerDay")
    max_fruit_on_tree = NumberAttribute(null=True, attr_name="maxFruitOnTree")
