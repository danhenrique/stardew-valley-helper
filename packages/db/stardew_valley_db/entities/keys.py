"""Key helpers shared by every entity in the single table."""

SEASONS: tuple[str, ...] = ("spring", "summer", "fall", "winter")
SEASON_INDEX: dict[str, int] = {season: index for index, season in enumerate(SEASONS)}

# Folders of the game dataset whose ids are unique across each other and are stored as ITEM#<id>.
ITEM_FOLDERS: frozenset[str] = frozenset(
    {
        "sementes",
        "arvores-frutiferas",
        "frutas",
        "vegetais",
        "flores",
        "cogumelos",
        "coleta",
        "peixes",
        "produtos-animais",
        "artesanato",
        "culinaria",
        "maquinas",
        "recursos",
        "minerais",
        "artefatos",
        "fosseis",
        "geodos",
        "ferramentas",
        "armas",
        "equipamentos",
        "pesca",
        "fertilizantes",
        "consumiveis",
        "fabricaveis",
        "moveis-e-decoracao",
        "livros",
        "berloques",
        "itens-especiais",
        "lanches-cinema",
    }
)


def entity_pk(prefix: str, entity_id: str) -> str:
    return f"{prefix}#{entity_id}"


def type_gsi1pk(folder: str) -> str:
    return f"TYPE#{folder}"
