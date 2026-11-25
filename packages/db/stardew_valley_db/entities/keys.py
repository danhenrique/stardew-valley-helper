"""Key helpers shared by every entity in the single table."""

SEASONS: tuple[str, ...] = ("spring", "summer", "fall", "winter")
SEASON_INDEX: dict[str, int] = {season: index for index, season in enumerate(SEASONS)}

# Folders of the game dataset whose ids are unique across each other and are stored as ITEM#<id>.
ITEM_FOLDERS: frozenset[str] = frozenset(
    {
        "seeds",
        "fruit-trees",
        "fruits",
        "vegetables",
        "flowers",
        "mushrooms",
        "forage",
        "fish",
        "animal-products",
        "artisan-goods",
        "cooking",
        "machines",
        "resources",
        "minerals",
        "artifacts",
        "fossils",
        "geodes",
        "tools",
        "weapons",
        "equipment",
        "fishing",
        "fertilizers",
        "consumables",
        "craftables",
        "furniture",
        "books",
        "trinkets",
        "special-items",
        "movie-snacks",
    }
)


def entity_pk(prefix: str, entity_id: str) -> str:
    return f"{prefix}#{entity_id}"


def type_gsi1pk(folder: str) -> str:
    return f"TYPE#{folder}"
