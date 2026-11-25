import json

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from stardew_valley_api.identity import LOCAL_PLAYER_ID, get_player_id

from .conftest import request_context


def fake_request(header: str | None) -> Request:
    headers = [(b"x-amzn-request-context", header.encode())] if header else []
    return Request({"type": "http", "headers": headers})


def test_should_return_cognito_sub_when_request_context_has_provider():
    assert get_player_id(fake_request(request_context("test-sub"))) == "test-sub"


def test_should_raise_403_when_header_is_missing(monkeypatch):
    monkeypatch.delenv("LOCAL_DEV", raising=False)
    with pytest.raises(HTTPException) as error:
        get_player_id(fake_request(None))
    assert error.value.status_code == 403


def test_should_raise_403_when_provider_is_missing(monkeypatch):
    monkeypatch.delenv("LOCAL_DEV", raising=False)
    with pytest.raises(HTTPException):
        get_player_id(fake_request(json.dumps({"identity": {}})))


def test_should_use_local_player_when_running_locally_without_header(monkeypatch):
    monkeypatch.setenv("LOCAL_DEV", "true")
    assert get_player_id(fake_request(None)) == LOCAL_PLAYER_ID
