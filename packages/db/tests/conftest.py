"""Shared fixtures. DynamoDB is an external dependency, so it is mocked with moto."""

from pathlib import Path

import pytest
from moto import mock_aws

TEST_TABLE = "test-stardew-valley-db"
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "data"


@pytest.fixture
def table(monkeypatch):
    """An empty in-memory table with the real key schema; removed after each test."""
    monkeypatch.delenv("LOCAL_DEV", raising=False)
    for key, value in {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": "us-east-1",
    }.items():
        monkeypatch.setenv(key, value)

    from stardew_valley_db.entities import base

    monkeypatch.setattr(base, "get_table_name", lambda: TEST_TABLE)
    with mock_aws():
        base.BaseModel._connection = None
        base.BaseModel.create_table(billing_mode="PAY_PER_REQUEST", wait=True)
        yield base.BaseModel
        base.BaseModel._connection = None


def count_items() -> int:
    from stardew_valley_db.entities import BaseModel

    return sum(1 for _ in BaseModel.scan())
