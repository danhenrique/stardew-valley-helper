"""Caller identity for an IAM-authenticated REST API (Cognito Identity Pool credentials)."""

import json
import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request

LOCAL_PLAYER_ID = "local-dev-player"
REQUEST_CONTEXT_HEADER = "x-amzn-request-context"


def get_player_id(request: Request) -> str:
    """The Cognito user pool sub, taken from the API Gateway request context (never from the body)."""
    header = request.headers.get(REQUEST_CONTEXT_HEADER)
    if not header:
        if os.environ.get("LOCAL_DEV") == "true":
            return LOCAL_PLAYER_ID
        raise HTTPException(status_code=403, detail="Unable to determine calling user")
    try:
        provider = json.loads(header).get("identity", {}).get("cognitoAuthenticationProvider")
    except json.JSONDecodeError, AttributeError:
        provider = None
    sub = provider.split(":")[-1] if provider else None
    if not sub:
        raise HTTPException(status_code=403, detail="Unable to determine calling user")
    return sub


PlayerId = Annotated[str, Depends(get_player_id)]
