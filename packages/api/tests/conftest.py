"""Shared fixtures. DynamoDB is external, so it is mocked with moto and seeded with the
fictitious dataset fixtures of the db project through the real importer."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

DB_FIXTURES = Path(__file__).resolve().parents[2] / "db" / "tests" / "fixtures" / "data"
TEST_TABLE = "test-stardew-valley-db"


@pytest.fixture
def table(monkeypatch):
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


@pytest.fixture
def seeded(table):
    from stardew_valley_db.importer.cli import main

    assert main(["--data-dir", str(DB_FIXTURES)]) == 0
    return table


def request_context(sub: str) -> str:
    provider = f"cognito-idp.sa-east-1.amazonaws.com/pool,cognito-idp.sa-east-1.amazonaws.com/pool:CognitoSignIn:{sub}"
    return json.dumps({"identity": {"cognitoAuthenticationProvider": provider}})


@pytest.fixture
def client(seeded):
    from stardew_valley_api.main import app

    return TestClient(app)


@pytest.fixture
def client_as(seeded):
    """Client factory sending the API Gateway request context of a given player."""
    from stardew_valley_api.main import app

    def make(sub: str) -> TestClient:
        return TestClient(app, headers={"x-amzn-request-context": request_context(sub)})

    return make
