import pytest

from stardew_valley_api.ttl_cache import TtlCache


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def counting_loader(value):
    calls = []

    def load():
        calls.append(1)
        return value

    return load, calls


def test_should_load_once_when_read_twice_within_the_ttl():
    clock = FakeClock()
    cache = TtlCache(600, clock=clock)
    load, calls = counting_loader("a")
    assert cache.get("k", load) == "a"
    clock.now = 599
    assert cache.get("k", load) == "a"
    assert len(calls) == 1


def test_should_load_again_when_the_ttl_has_passed():
    clock = FakeClock()
    cache = TtlCache(600, clock=clock)
    load, calls = counting_loader("a")
    cache.get("k", load)
    clock.now = 600
    cache.get("k", load)
    assert len(calls) == 2


def test_should_not_store_a_value_when_the_loader_raises():
    cache = TtlCache(600, clock=FakeClock())

    def fail():
        raise LookupError("missing")

    with pytest.raises(LookupError):
        cache.get("k", fail)
    load, calls = counting_loader("b")
    assert cache.get("k", load) == "b" and len(calls) == 1


def test_should_load_again_when_cleared():
    cache = TtlCache(600, clock=FakeClock())
    load, calls = counting_loader("a")
    cache.get("k", load)
    cache.clear()
    cache.get("k", load)
    assert len(calls) == 2


def test_should_not_store_a_value_when_keep_rejects_it():
    cache = TtlCache(600, clock=FakeClock())
    load, calls = counting_loader({})
    assert cache.get("k", load, keep=bool) == {}
    assert cache.get("k", load, keep=bool) == {}
    assert len(calls) == 2


def test_should_store_a_value_when_keep_accepts_it():
    cache = TtlCache(600, clock=FakeClock())
    load, calls = counting_loader({"a": 1})
    cache.get("k", load, keep=bool)
    cache.get("k", load, keep=bool)
    assert len(calls) == 1
