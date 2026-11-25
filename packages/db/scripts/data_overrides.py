"""Hand-made dataset changes that the generator cannot reproduce.

`packages/db/overrides/<folder>/<id>.json` mirrors `data/`. `build-data.py` applies every file on top
of what it generates: an id the generator does not produce is added as is; an existing one gets the
override's fields merged in (maps merge key by key, everything else is replaced). Fix the dataset
here, never directly in `data/`, or the next regeneration loses the change.
"""

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

EntityKey = tuple[str, str]


class OverrideError(Exception):
    pass


def load_overrides(root: Path) -> dict[EntityKey, dict[str, Any]]:
    """Every override file under `root`, keyed by (folder, id). A missing folder means none."""
    if not root.is_dir():
        return {}
    found: dict[EntityKey, dict[str, Any]] = {}
    for path in sorted(root.glob("*/*.json")):
        folder, entity_id = path.parent.name, path.stem
        doc = json.loads(path.read_text(encoding="utf-8"))
        if doc.get("id") != entity_id or doc.get("type") != folder:
            raise OverrideError(f"{path}: id/type must be {entity_id!r}/{folder!r}")
        found[(folder, entity_id)] = doc
    return found


def overlay(base: dict[str, Any], patch: dict[str, Any], lead_keys: Iterable[str]) -> dict[str, Any]:
    """`base` with `patch` merged in. Keys new to `base` go right after its leading keys."""
    lead = [k for k in lead_keys if k in base]
    merged = dict(base)
    added: dict[str, Any] = {}
    for key, value in patch.items():
        if key in base:
            old = base[key]
            merged[key] = overlay(old, value, ()) if isinstance(old, dict) and isinstance(value, dict) else value
        else:
            added[key] = value
    if not added:
        return merged
    head = {k: merged[k] for k in lead}
    tail = {k: v for k, v in merged.items() if k not in head}
    return head | added | tail


def apply_overrides(
    entities: dict[EntityKey, dict[str, Any]],
    found: dict[EntityKey, dict[str, Any]],
    lead_keys: Iterable[str],
) -> None:
    lead = tuple(lead_keys)
    for key, doc in found.items():
        entities[key] = overlay(entities[key], doc, lead) if key in entities else dict(doc)
