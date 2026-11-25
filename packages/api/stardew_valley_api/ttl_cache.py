"""Tiny in-memory cache with a time to live, kept per Lambda instance."""

import time
from collections.abc import Callable
from typing import Any


class TtlCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._entries: dict[str, tuple[float, Any]] = {}

    def get[T](self, key: str, load: Callable[[], T], keep: Callable[[T], bool] | None = None) -> T:
        """Cached value of `key`, loading it when missing or expired. A raising loader stores nothing,
        and neither does a value that `keep` rejects (so a transient empty result is retried)."""
        now = self.clock()
        entry = self._entries.get(key)
        if entry is not None and now < entry[0]:
            return entry[1]
        value = load()
        if keep is not None and not keep(value):
            return value
        self._entries[key] = (now + self.ttl_seconds, value)
        return value

    def clear(self) -> None:
        self._entries.clear()
