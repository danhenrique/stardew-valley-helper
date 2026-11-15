"""Read and validate every JSON file of the dataset before anything is written."""

import json
from pathlib import Path
from typing import Any

META_FOLDER = "_meta"
SKIPPED_META = {"index", "pending-translations"}


class ImportValidationError(Exception):
    def __init__(self, path: Path, reason: str):
        super().__init__(f"{path}: {reason}")
        self.path = path
        self.reason = reason


def _read(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ImportValidationError(path, f"invalid JSON ({error})") from error


def load_dataset(data_dir: Path) -> dict[str, list[dict]]:
    dataset: dict[str, list[dict]] = {}
    for folder in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        docs: list[dict] = []
        for path in sorted(folder.glob("*.json")):
            if folder.name == META_FOLDER and path.stem in SKIPPED_META:
                continue
            doc = _read(path)
            if not isinstance(doc, dict):
                raise ImportValidationError(path, "expected a JSON object")
            if folder.name == META_FOLDER:
                doc = {**doc, "id": doc.get("id", path.stem)}
            else:
                if not doc.get("id"):
                    raise ImportValidationError(path, "missing id")
                if doc.get("type") != folder.name:
                    raise ImportValidationError(path, f"type {doc.get('type')!r} does not match folder")
            docs.append(doc)
        dataset[folder.name] = docs
    return dataset
