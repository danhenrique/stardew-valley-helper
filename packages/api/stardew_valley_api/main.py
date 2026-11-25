import uvicorn

from .init import app
from .routes import farm_plans, fish, game, machines, player  # noqa: F401  (registers routes)

__all__ = ["app"]

if __name__ == "__main__":
    uvicorn.run("stardew_valley_api.main:app", port=8000)
