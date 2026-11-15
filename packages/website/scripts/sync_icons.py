"""Copy the Stardew Valley scheduler icons into the website, renamed to data ids.

Usage (from the repository root):

    python3 -I packages/website/scripts/sync_icons.py \\
        .tmp/stardew-valley-scheduler/public/icons packages/db/data/_meta/index.json

Writes ``packages/website/public/icons``:

- ``<id>.png`` for every data id with a matching PNG;
- ``ui/<name>.<ext>`` for every other image (no matching id, or not a PNG);
- ``variants/<folder>/<name>.png`` for the other copies of an id's sprite (other folders or sizes);
- ``NOTICE.txt`` with the ConcernedApe credit;

and ``src/lib/icon-manifest.json`` with the sorted ids that have an image (inside ``src`` so
the website can import it).

The destination is cleared first, so the output only depends on the inputs.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

# Preferred source folder when several hold the same id: item sprites before
# collection/perfection copies. Unlisted folders sort after, alphabetically.
FOLDER_ORDER = [
    "villagers",
    "shops",
    "festival",
    "movies",
    "snacks",
    "reminders",
    "machines",
    "buildings",
    "tools",
    "fish",
    "gifts",
    "food",
    "seeds",
    "materials",
    "machineOutputs",
    "bundleItems",
    "costMaterials",
    "museum",
    "fruitTrees/saplings",
    "fruitTrees",
    "fertilizer",
    "profitFertilizer",
    "fieldOffice",
    "addTask",
    "event",
    "ui",
]


@dataclass
class Report:
    missing: dict[str, list[str]] = field(default_factory=dict)
    ui_files: list[str] = field(default_factory=list)
    # Files an override replaced: the image the automatic match would have used.
    replaced: list[str] = field(default_factory=list)
    # Other copies of an id's sprite (other folders or sizes), kept under variants/.
    variant_files: list[str] = field(default_factory=list)
    copied: int = 0
    # Distinct source files copied (one file can serve several ids through overrides).
    sources_copied: int = 0


def normalize(name: str) -> str:
    """Kebab-case a file name: ``Aged_Roe`` -> ``aged-roe``."""
    split = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", name).lower()
    return re.sub(r"[^a-z0-9]+", "-", split).strip("-")


def squash(name: str) -> str:
    """Lowercase and drop every non-alphanumeric character."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _folder_key(folder: str) -> tuple[int, str]:
    position = FOLDER_ORDER.index(folder) if folder in FOLDER_ORDER else len(FOLDER_ORDER)
    return (position, folder)


def _source_files(source: Path) -> list[tuple[str, Path]]:
    """Every file as (folder, path), in folder preference order then name."""
    files = [
        (path.parent.relative_to(source).as_posix(), path)
        for path in source.rglob("*")
        if path.is_file()
    ]
    return sorted(files, key=lambda f: (_folder_key(f[0]), f[1].name))


def _load_index(index: Path) -> dict[str, list[str]]:
    data = json.loads(index.read_text())
    return {folder: ids for folder, ids in data.items() if isinstance(ids, list)}


def sync(source: Path, index: Path, overrides: Path, dest: Path, manifest: Path) -> Report:
    folders = _load_index(index)
    ids = {i for folder_ids in folders.values() for i in folder_ids}
    by_squash: dict[str, str] = {}
    for i in sorted(ids):
        by_squash.setdefault(squash(i), i)

    override_map: dict[str, str] = json.loads(overrides.read_text())
    override_sources = set()
    chosen: dict[str, Path] = {}
    for i, rel in sorted(override_map.items()):
        path = source / rel
        if not path.is_file():
            raise FileNotFoundError(f"override for {i!r} not found: {rel}")
        if path.suffix.lower() != ".png":
            raise ValueError(f"override for {i!r} is not a PNG: {rel}")
        chosen[i] = path
        override_sources.add(path)

    overridden = set(chosen)
    replaced: list[Path] = []
    variants: list[tuple[str, Path]] = []
    ui: list[tuple[str, Path]] = []
    for folder, path in _source_files(source):
        stem = path.stem
        match = normalize(stem) if normalize(stem) in ids else by_squash.get(squash(stem))
        if path.suffix.lower() == ".png" and match:
            if match in overridden and path not in override_sources:
                overridden.discard(match)  # report only the file the match would have used
                replaced.append(path)
            if chosen.setdefault(match, path) != path:
                variants.append((folder, path))
        elif path not in override_sources:
            ui.append((folder, path))
    # The scheduler's own ui/ folder keeps its names; other folders get prefixed on a clash.
    ui.sort(key=lambda f: f[0] != "ui")

    if dest.exists():
        shutil.rmtree(dest)
    (dest / "ui").mkdir(parents=True)

    report = Report(replaced=[p.relative_to(source).as_posix() for p in replaced])
    for i, path in sorted(chosen.items()):
        shutil.copyfile(path, dest / f"{i}.png")
    report.copied = len(chosen)

    for folder, path in ui:
        name = normalize(path.stem) + path.suffix.lower()
        target = dest / "ui" / name
        if target.exists():
            target = dest / "ui" / f"{normalize(folder) or 'root'}-{name}"
        if target.exists():
            raise FileExistsError(f"ui name clash: {path}")
        shutil.copyfile(path, target)
        report.ui_files.append(target.relative_to(dest).as_posix())

    for folder, path in variants:
        folder_path = "/".join(normalize(part) for part in folder.split("/")) or "root"
        target = dest / "variants" / folder_path / f"{normalize(path.stem)}.png"
        if target.exists():
            raise FileExistsError(f"variant name clash: {path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        report.variant_files.append(target.relative_to(dest).as_posix())

    report.sources_copied = len(
        set(chosen.values()) | {p for _, p in ui} | {p for _, p in variants}
    )
    manifest.write_text(json.dumps(sorted(chosen), indent=2) + "\n")
    shutil.copyfile(SCRIPT_DIR / "ICONS_NOTICE.txt", dest / "NOTICE.txt")

    for folder, folder_ids in sorted(folders.items()):
        missing = sorted(i for i in folder_ids if i not in chosen)
        if missing:
            report.missing[folder] = missing
    return report


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    source, index = Path(argv[1]), Path(argv[2])
    dest = SCRIPT_DIR.parent / "public" / "icons"
    manifest = SCRIPT_DIR.parent / "src" / "lib" / "icon-manifest.json"
    report = sync(source, index, SCRIPT_DIR / "icon-overrides.json", dest, manifest)
    total = sum(1 for p in source.rglob("*") if p.is_file())
    print(f"source files: {total}")
    print(f"ids with an image: {report.copied}")
    print(f"ui files: {len(report.ui_files)}")
    print(f"variants (other copies of an id's sprite): {len(report.variant_files)}")
    print(f"source files copied: {report.sources_copied} of {total}")
    print(f"replaced by an override: {', '.join(report.replaced) or 'none'}")
    print("ids without an image:")
    for folder, missing in report.missing.items():
        print(f"  {folder} ({len(missing)}): {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
