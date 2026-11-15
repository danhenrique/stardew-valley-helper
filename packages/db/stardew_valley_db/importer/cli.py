"""One-shot import: `nx run stardew_valley_helper.stardew_valley_db:import [--data-dir DIR] [--dry-run]`.

Everything is loaded and converted before the first write, so an invalid file writes nothing.
Keys are deterministic, so running it again overwrites instead of duplicating.
"""

import argparse
from collections import Counter
from pathlib import Path

from aws_lambda_powertools import Logger

from ..entities import BaseModel
from .convert import convert_dataset
from .corrections import apply_corrections
from .load import ImportValidationError, load_dataset

logger = Logger(service="stardew-valley-import")

# The game dataset is versioned next to this project: packages/db/data
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import the Stardew Valley dataset into DynamoDB.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--dry-run", action="store_true", help="convert without writing")
    args = parser.parse_args(argv)

    try:
        dataset, corrections = apply_corrections(load_dataset(args.data_dir))
        result = convert_dataset(dataset)
    except ImportValidationError as error:
        logger.error("Invalid dataset file, nothing written", extra={"path": str(error.path), "reason": error.reason})
        return 1

    for correction in corrections:
        logger.info("Dataset correction applied", extra=correction)
    for diff in result.diffs:
        logger.warning("Source difference", extra={"diff": diff})
    counts = Counter(type(model).__name__ for model in result.models)

    if args.dry_run:
        logger.info("Dry run, nothing written", extra={"counts": dict(counts), "total": len(result.models)})
        return 0

    with BaseModel.batch_write() as batch:
        for model in result.models:
            batch.save(model)
    logger.info("Import finished", extra={"counts": dict(counts), "total": len(result.models)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
