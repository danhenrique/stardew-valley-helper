#!/usr/bin/env python3
"""Build data/<folder>/<id>.json from the stardew-valley-scheduler repository.

Usage: python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data \
           [.tmp/Content-unpacked]
Locales: en + pt-BR. pt-BR comes from, in priority order:
  1. src/data/gameItemNames.json  (extracted from the game files -> official)
  2. the unpacked game content, when given (game_strings.py -> official)
  3. messages/pt-BR.json          (app strings; flagged nameVerified=false)
"""
import importlib.util, json, re, sys, shutil
from pathlib import Path

REPO = Path(sys.argv[1]); OUT = Path(sys.argv[2])
_gs_spec = importlib.util.spec_from_file_location("game_strings", Path(__file__).with_name("game_strings.py"))
game_strings = importlib.util.module_from_spec(_gs_spec); _gs_spec.loader.exec_module(game_strings)
GAME = game_strings.GameStrings(Path(sys.argv[3])) if len(sys.argv) > 3 else None
LOCALES = ["en", "pt-BR"]

def load(p): return json.loads((REPO / p).read_text(encoding="utf-8"))
N = load("src/data/gameItemNames.json")
EN = load("messages/en.json"); PT = load("messages/pt-BR.json")
CATS = load("src/data/category-members.json")
GIFTS = load("src/data/gifts.json"); UNIV = load("src/data/universal-gifts.json")
MOVIES = load("src/data/moviePrefs.json"); SHOPS = load("src/data/costMaterials.json")
def ts(p): return (REPO / "src/data" / p).read_text(encoding="utf-8")

pending = []  # names without an official pt-BR translation

def slug(s):
    s = s.replace("&", " and ").replace("ñ", "n").replace(".", "")
    s = re.sub(r"['\"«»]", "", s)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", s)
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()

def lname(en, pt_fallback=None, ctx=""):
    """Return (name{en,pt-BR}, verified)."""
    row = N.get(en)
    if row and row.get("pt-BR"):
        return {"en": en, "pt-BR": row["pt-BR"]}, True
    official = GAME and GAME.name(ctx.split("/")[0], en)
    if official:
        return {"en": en, "pt-BR": official}, True
    pending.append({"context": ctx, "en": en, "ptBrUnverified": pt_fallback})
    return {"en": en, "pt-BR": pt_fallback}, False

def msg(ns_path, key):
    """en/pt values from messages at path 'a.b' + key."""
    def get(d):
        for p in ns_path.split("."): d = d.get(p, {})
        return d.get(key)
    return get(EN), get(PT)

# ---------------------------------------------------------------- registry
ENT = {}  # (folder,id) -> dict
ITEM_FOLDER = {}  # item id -> folder
ALIASES = {"Warp Totem Desert": "Warp Totem: Desert", "Cranberry": "Cranberries", "Cookies": "Cookie", "L. Goat Milk": "Large Goat Milk"}
ID_OVERRIDE = {
    "White Chicken": "chicken", "White Cow": "cow", "Horse Stable": "stable",
    "ShippingBox": "shipping-bin", "Log Cabin Stage 1": "cabin",
    "House (tier 2)": "farmhouse-upgrade-1", "House (tier 3)": "farmhouse-upgrade-2",
    "House (tier 4)": "farmhouse-upgrade-3", "Copper Tools": "tool-upgrade-copper",
    "Steel Tools": "tool-upgrade-steel", "Gold Tools": "tool-upgrade-gold",
    "Iridium Tools": "tool-upgrade-iridium", "Wallpaper 022 Icon": "wallpaper-joja",
    "Wallpaper 001 Icon": "wallpaper", "Flooring 01 Icon": "flooring",
}
SKIP = {"Stone Cabin Stage 1", "Plank Cabin Stage 1", "Warp Totem Desert"}

def item_id(en):
    en = ALIASES.get(en, en)
    return ID_OVERRIDE.get(en) or slug(en)

def put(folder, eid, data):
    key = (folder, eid)
    if key in ENT:
        merge(ENT[key], data)
    else:
        ENT[key] = {"id": eid, "type": folder, **data}
    return ENT[key]

def merge(a, b):
    for k, v in b.items():
        if k not in a or a[k] in (None, [], {}):
            a[k] = v
        elif isinstance(a[k], dict) and isinstance(v, dict):
            merge(a[k], v)
        elif isinstance(a[k], list) and isinstance(v, list):
            for x in v:
                if x not in a[k]: a[k].append(x)

# --------------------------------------------------- item classification
CAT_FOLDER = {
    "fruits": "fruits", "treeFruit": "fruits", "vegetables": "vegetables",
    "flowers": "flowers", "mushrooms": "mushrooms", "eggs": "animal-products",
    "milk": "animal-products", "artisanGoods": "artisan-goods", "gems": "minerals",
    "geodeMinerals": "minerals", "foragedMinerals": "minerals", "artifacts": "artifacts",
    "fish": "fish", "cooking": "cooking", "books": "books", "trinkets": "trinkets",
}
L = lambda s: [x.strip() for x in s.split("|") if x.strip()]
EXPLICIT = {
    "vegetables": L("Carrot|Summer Squash|Broccoli"),
    "forage": L("Wild Horseradish|Daffodil|Leek|Dandelion|Spring Onion|Hazelnut|Holly|Snow Yam|Winter Root|Cave Carrot|Ginger|Salmonberry|Coral|Nautilus Shell|Rainbow Shell|Sea Urchin|Driftwood|Moss|Sweet Gem Berry"),
    "animal-products": L("Wool|Duck Feather|Rabbit's Foot|Truffle|Roe|Squid Ink"),
    "resources": L("Wood|Stone|Hardwood|Fiber|Clay|Coal|Sap|Copper Ore|Iron Ore|Gold Ore|Iridium Ore|Radioactive Ore|Copper Bar|Iron Bar|Gold Bar|Iridium Bar|Radioactive Bar|Refined Quartz|Bat Wing|Slime|Void Essence|Solar Essence|Bone Fragment|Cinder Shard|Dragon Tooth|Green Algae|White Algae|Seaweed|Oak Resin|Pine Tar|Maple Syrup|Mystic Syrup|Battery Pack|Hay|Bug Meat|Sugar|Wheat Flour|Rice|Qi Seasoning"),
    "geodes": L("Geode|Frozen Geode|Magma Geode|Omni Geode|Artifact Trove|Golden Coconut|Mystery Box|Golden Mystery Box|Treasure Chest"),
    "tools": L("Copper Hoe|Steel Hoe|Gold Hoe|Iridium Hoe|Milk Pail|Shears|Copper Pan|Bamboo Pole|Training Rod|Fiberglass Rod|Iridium Rod|Return Scepter|Horse Flute|Copper Tools|Steel Tools|Gold Tools|Iridium Tools|Trash Can Copper|Trash Can Steel|Trash Can Gold|Trash Can Iridium|Large Pack|Deluxe Pack"),
    "weapons": L("Wooden Blade|Iron Dirk|Silver Saber|Pirate's Sword|Cutlass|Wood Mallet|Claymore|Templar's Blade|Bone Sword|Steel Falchion|Lava Katana|Galaxy Sword|Galaxy Dagger|Galaxy Hammer|Slingshot|Master Slingshot|Explosive Ammo|Insect Head"),
    "equipment": L("Amethyst Ring|Aquamarine Ring|Emerald Ring|Jade Ring|Ruby Ring|Topaz Ring|Burglar's Ring|Crabshell Ring|Napalm Ring|Savage Ring|Slime Charmer Ring|Vampire Ring|Combat Boots|Dark Boots|Firewalker Boots|Leather Boots|Space Boots|Tundra Boots|Sneakers|Hard Hat|Skeleton Mask|Arcane Hat|Knight's Helmet|Top Hat|Green Turban|Magic Cowboy Hat|Magic Turban|Mr. Qi's Hat|Random Shirt"),
    "fishing": L("Bait|Magic Bait|Magnet|Spinner|Dressed Spinner|Trap Bobber|Lead Bobber|Cork Bobber|Treasure Hunter|Barbed Hook|Crab Pot"),
    "fertilizers": L("Basic Fertilizer|Quality Fertilizer|Deluxe Fertilizer|Basic Retaining Soil|Quality Retaining Soil|Deluxe Retaining Soil|Speed-Gro|Deluxe Speed-Gro|Hyper Speed-Gro|Tree Fertilizer"),
    "machines": L("Dehydrator|Fish Smoker|Heater|Auto-Grabber|Hopper|Enricher|Pressure Nozzle|Deconstructor|Heavy Tapper|Sprinkler|Quality Sprinkler|Iridium Sprinkler"),
    "buildings": L("Barn|Big Barn|Deluxe Barn|Coop|Big Coop|Deluxe Coop|Fish Pond|Mill|Shed|Big Shed|Silo|Slime Hutch|Horse Stable|Well|Log Cabin Stage 1|ShippingBox|House (tier 2)|House (tier 3)|House (tier 4)|Earth Obelisk|Water Obelisk|Desert Obelisk|Island Obelisk|Gold Clock|Junimo Hut"),
    "consumables": L("Energy Tonic|Muscle Remedy|Joja Cola|J. Cola Light|Life Elixir|Magic Rock Candy|Bomb|Mega Bomb|Cherry Bomb|Warp Totem: Desert|Warp Totem Farm|Staircase|Field Snack|Piña Colada|Stardrop|Monster Musk|Butterfly Powder"),
    "furniture": L("'Burnt Offering'|'Highway 89'|'Jade Hills Extended'|'Primal Motion'|'Spires'|Large Brown Couch|Large Cottage Rug|Large Green Rug|Old World Rug|Birch Double Bed|Midnight Beach Bed|Midnight Beach Double Bed|Modern Double Bed|Fisher Double Bed|Exotic Double Bed|Dark Piano|Small Fish Tank|Large Fish Tank|Deluxe Fish Tank|Aquatic Sanctuary|Wall Sconce 1|Wall Sconce 2|Wall Sconce 3|Wall Sconce 4|Wall Sconce 5|Wall Sconce 7|Wall Cactus|Monster Fireplace|Sign Of The Vessel|Hardwood Fence|Rarecrow 3|Wallpaper 022 Icon|Wallpaper 001 Icon|Flooring 01 Icon|Ornamental Hay Bale|Decorative Sword|Wall Sword|Crystal Floor|Crystal Path|Wicked Statue|Butterfly Hutch|Void Ghost Pendant|Seasonal Plant|Catalogue|Wizard Catalogue"),
    "animals": L("White Chicken|White Cow|Goat|Duck|Sheep|Rabbit|Pig"),
    "fossils": L("Fossilized Leg|Fossilized Ribs|Fossilized Skull|Fossilized Spine|Fossilized Tail|Mummified Frog|Mummified Bat|Snake Skull|Snake Vertebrae"),
    "special-items": L("Golden Walnut|Qi Gem|Galaxy Soul|Golden Pumpkin|Pearl|Key To The Town|Pierre's Missing Stocklist|Marlon's Phone Number|Broken Glasses|Bouquet|Junimo Chest|Mushroom Tree Seed|Grass Starter"),
}
NAME_FOLDER = {}
for k, members in CATS.items():
    for m in members: NAME_FOLDER.setdefault(m["en"], CAT_FOLDER[k])
for f, names in EXPLICIT.items():
    for n in names: NAME_FOLDER[n] = f  # explicit lists win
SEED_RE = re.compile(r"(Seeds?|Starter|Bulb|Shoot|Sapling|Tuber)$|^(Coffee Bean|Acorn|Maple Seed|Pine Cone|Mahogany Seed)$")
MOVIE_NAMES = {x["en"] for v in MOVIES.values() for k in ("lovedMovies", "likedMovies") for x in v[k]}
SNACK_NAMES = {x["en"] for v in MOVIES.values() for k in ("lovedSnacks", "likedSnacks") for x in v[k]}
MONSTER_NAMES = set(re.findall(r'en: "([^"]+)", count', ts("monsterGoals.ts")))

def folder_of(en):
    en = ALIASES.get(en, en)
    if en in NAME_FOLDER: return NAME_FOLDER[en]
    if en in MOVIE_NAMES: return "movies"
    if en in SNACK_NAMES: return "movie-snacks"
    if en.endswith("Sapling"): return "fruit-trees"
    if SEED_RE.search(en): return "seeds"
    return "misc-items"

def item(en, pt_fallback=None, folder=None, ctx="item", **data):
    """Register/update an item and return its id."""
    en = ALIASES.get(en, en)
    if en in SKIP: en = ALIASES.get(en, en)
    iid = item_id(en)
    f = folder or ITEM_FOLDER.get(iid) or folder_of(en)
    ITEM_FOLDER.setdefault(iid, f)
    f = ITEM_FOLDER[iid]
    key = (f, iid)
    if key not in ENT:
        nm, ok = lname(en, pt_fallback, ctx=f"{f}/{iid}")
        put(f, iid, {"name": nm, "nameVerified": ok})
    elif ENT[key]["name"].get("pt-BR") is None and pt_fallback:
        ENT[key]["name"]["pt-BR"] = pt_fallback
        for p in pending:
            if p["context"] == f"{f}/{iid}": p["ptBrUnverified"] = pt_fallback
    if data: merge(ENT[key], data)
    return iid

# ============================================================ 1. base items
for en in N:
    if en in SKIP or en in MONSTER_NAMES: continue
    item(en)
for k, members in CATS.items():
    for m in members:
        iid = item(m["en"])
        e = ENT[(ITEM_FOLDER[iid], iid)]
        e.setdefault("tags", [])
        if k not in e["tags"]: e["tags"].append(k)

# useful subtypes
SUBTYPE = {"gems": "gem", "geodeMinerals": "geode-mineral", "foragedMinerals": "foraged-mineral",
           "treeFruit": "tree-fruit", "eggs": "egg", "milk": "milk"}
for (f, i), e in ENT.items():
    for t in e.get("tags", []):
        if t in SUBTYPE: e["subtype"] = SUBTYPE[t]
for n in EXPLICIT["equipment"]:
    iid = item(n); e = ENT[("equipment", iid)]
    e["subtype"] = "ring" if n.endswith("Ring") else "boots" if ("Boots" in n or n == "Sneakers") else "shirt" if "Shirt" in n else "hat"
for n in EXPLICIT["tools"]:
    iid = item(n)
    if "Tools" in n or "Trash Can" in n or "Pack" in n: ENT[("tools", iid)]["subtype"] = "upgrade"

# ============================================================ 2. crops
crop_src = ts("game-data.ts")
CROPS = []
for m in re.finditer(r'\{ id: "(\w+)", seasons: \[([^\]]*)\], growthDays: ([\d.]+)(.*?)\},?\n', crop_src):
    cid, seas, gd, rest = m.groups()
    c = {"key": cid, "seasons": re.findall(r'"(\w+)"', seas), "growthDays": int(gd)}
    ph = re.search(r"phases: \[([^\]]*)\]", rest)
    if ph: c["phases"] = [int(x) for x in ph.group(1).split(",")]
    for fld in ("regrowDays", "sellPrice", "extraYield", "kegPrice", "jarPrice"):
        mm = re.search(fld + r": ([\d.]+)", rest)
        if mm: v = float(mm.group(1)); c[fld] = int(v) if v.is_integer() else v
    c["isWildseed"] = "isWildseed: true" in rest
    c["isTea"] = "isTea: true" in rest
    CROPS.append(c)

SEED_OF = {
    "parsnip": "Parsnip Seeds", "potato": "Potato Seeds", "cauliflower": "Cauliflower Seeds",
    "kale": "Kale Seeds", "garlic": "Garlic Seeds", "rhubarb": "Rhubarb Seeds",
    "strawberry": "Strawberry Seeds", "greenBean": "Bean Starter", "tulip": "Tulip Bulb",
    "blueJazz": "Jazz Seeds", "coffeeBean": "Coffee Bean", "blueberry": "Blueberry Seeds",
    "melon": "Melon Seeds", "tomato": "Tomato Seeds", "hotPepper": "Pepper Seeds",
    "radish": "Radish Seeds", "hops": "Hops Starter", "poppy": "Poppy Seeds",
    "redCabbage": "Red Cabbage Seeds", "starfruit": "Starfruit Seeds", "wheat": "Wheat Seeds",
    "corn": "Corn Seeds", "sunflower": "Sunflower Seeds", "pumpkin": "Pumpkin Seeds",
    "cranberry": "Cranberry Seeds", "eggplant": "Eggplant Seeds", "amaranth": "Amaranth Seeds",
    "grape": "Grape Starter", "yam": "Yam Seeds", "bokChoy": "Bok Choy Seeds",
    "artichoke": "Artichoke Seeds", "beet": "Beet Seeds", "fairyRose": "Fairy Seeds",
    "sweetGemBerry": "Rare Seed", "carrot": "Carrot Seeds", "unmilledRice": "Rice Shoot",
    "springSeeds": "Spring Seeds", "pineapple": "Pineapple Seeds", "summerSquash": "Summer Squash Seeds",
    "taroRoot": "Taro Tuber", "summerSpangle": "Spangle Seeds", "summerSeeds": "Summer Seeds",
    "broccoli": "Broccoli Seeds", "fallSeeds": "Fall Seeds", "powdermelon": "Powdermelon Seeds",
    "winterSeeds": "Winter Seeds", "teaLeaves": "Tea Sapling", "ancientFruit": "Ancient Seeds",
}
# pt seed names from messages (crafting recipes), when available
CRAFT_PT = {EN["perfectionItems"]["crafting"][k]: PT["perfectionItems"]["crafting"].get(k)
            for k in EN["perfectionItems"]["crafting"]}
# unverified pt seed names for seeds missing from the crafting messages
CRAFT_PT.update({"Strawberry Seeds": "Sementes de Morango", "Carrot Seeds": "Sementes de Cenoura"})
for c in CROPS:
    k = c["key"]; seed_en = SEED_OF[k]
    crop_en, crop_pt = msg("crops", k)
    wild = c["isWildseed"]
    plant = {"seasons": c["seasons"], "growthDays": c["growthDays"]}
    if "phases" in c: plant["phases"] = c["phases"]
    plant["regrowDays"] = c.get("regrowDays")
    plant["lastPlantingDay"] = 28 - c["growthDays"] if len(c["seasons"]) == 1 else None
    plant["averageExtraYield"] = c.get("extraYield", 0)
    if c["isTea"]: plant["notes"] = ["harvestOnlyLast7DaysOfSeason"]
    if wild:
        seed_id = item(seed_en, CRAFT_PT.get(seed_en), folder="seeds",
                       crop={**plant, "produce": "seasonal-forage"},
                       averageForageValue=c["sellPrice"])
        continue
    produce_id = item(crop_en, crop_pt, folder=None if crop_en != seed_en else "seeds")
    pe = ENT[(ITEM_FOLDER[produce_id], produce_id)]
    merge(pe, {"sellPrice": c["sellPrice"],
               "artisan": {k2: v for k2, v in (("kegPrice", c.get("kegPrice")), ("jarPrice", c.get("jarPrice"))) if v}})
    seed_id = item(seed_en, CRAFT_PT.get(seed_en), folder="seeds", crop={**plant, "produce": produce_id})
    pe["growsFrom"] = seed_id

# fruit trees
for m in re.finditer(r'\{ id: "(\w+)", season: "(\w+)" \}', ts("fruitTrees.ts")):
    k, season = m.groups()
    fruit_en, fruit_pt = msg("fruitTrees", k)
    fruit_id = item(fruit_en, fruit_pt)
    sap_en = f"{fruit_en} Sapling"
    sid = item(sap_en, folder="fruit-trees",
               fruitTree={"fruit": fruit_id, "season": season, "daysToMature": 28,
                          "fruitsPerDay": 1, "maxFruitOnTree": 3})
    ENT[(ITEM_FOLDER[fruit_id], fruit_id)]["growsFrom"] = sid

# ============================================================ 3. shops and offers
SHOP_NAME = EN["costMaterials"]["shops"]; SHOP_NAME_PT = PT["costMaterials"]["shops"]
SCHED_EN = EN["shopSchedule"]["shops"]; SCHED_PT = PT["shopSchedule"]["shops"]
SHOP_ID = {"wizard": "wizardTower"}  # unify ids
WD = {"월요일": "mon", "화요일": "tue", "수요일": "wed", "목요일": "thu", "금요일": "fri",
      "토요일": "sat", "일요일": "sun", "짝수 날": "evenDays", "홀수 날": "oddDays"}
SEASON_KO = {"봄": "spring", "여름": "summer", "가을": "fall", "겨울": "winter"}
BUILD_KO = {"닭장": "coop", "큰 닭장": "big-coop", "디럭스 닭장": "deluxe-coop",
            "외양간": "barn", "큰 외양간": "big-barn", "디럭스 외양간": "deluxe-barn"}
MON_KO = {re.search(r'ko: "([^"]+)", en', l).group(1): re.search(r'id: "(\w+)"', l).group(1)
          for l in ts("monsterGoals.ts").splitlines() if 'count: ' in l and 'id: "' in l}

def parse_note(note):
    out = {}; unknown = []
    for part in [p.strip() for p in note.split("/")]:
        if m := re.fullmatch(r"(봄|여름|가을|겨울) 한정", part): out["season"] = SEASON_KO[m.group(1)]
        elif part == "2년차 이후": out["fromYear"] = 2
        elif m := re.fullmatch(r"1년차 (\d+)골드", part): out.setdefault("priceByYear", {})["year1"] = int(m.group(1))
        elif m := re.fullmatch(r"2년차부터 (\d+)골드", part): out.setdefault("priceByYear", {})["year2plus"] = int(m.group(1))
        elif part == "요리 로테이션": out["rotating"] = True
        elif part == "수요일마다 무작위 생선 또는 자석 미끼": out["special"] = "wednesdayRandomFishOrMagnetBait"
        elif m := re.fullmatch(r"(.+) 필요", part): out["requiresBuilding"] = BUILD_KO[m.group(1)]
        elif part == "낚시 레벨 제한 없음": out["fishingLevel"] = 0
        elif m := re.fullmatch(r"낚시 레벨 (\d+)", part): out["fishingLevel"] = int(m.group(1))
        elif m := re.fullmatch(r"박멸 목표: (.+?) (\d+)마리 처치 후 구매 가능", part):
            out["requiresMonsterGoal"] = slug(MON_KO[m.group(1)])
        elif m := re.fullmatch(r"(\d+)개 묶음 판매", part): out["packSize"] = int(m.group(1))
        elif part.startswith("크로버스와"): out["special"] = "onlyOneAtMaxKrobusFriendshipWhileSingle"
        elif m := re.fullmatch(r"카지노 코인 ([\d,]+)", part): out["currency"] = {"qiCoins": int(m.group(1).replace(",", ""))}
        elif m := re.fullmatch(r"치 보석 (\d+)", part): out["currency"] = {"qiGems": int(m.group(1))}
        elif m := re.fullmatch(r"황금 호두 (\d+)", part): out["currency"] = {"goldenWalnuts": int(m.group(1))}
        else: unknown.append(part)
    if unknown: raise SystemExit(f"unmapped note: {unknown}")
    return out

SHOP_OFFERS = {}
for s in SHOPS:
    sid = SHOP_ID.get(s["id"], s["id"])
    offers = []
    for o in s["offers"]:
        if o["en"] in SKIP and o["en"] not in ALIASES: continue
        iid = item(o["en"])
        off = {"item": iid}
        if o.get("recipe"): off["recipe"] = True
        off["price"] = o["gold"]
        if o["materials"]:
            off["materials"] = [{"item": item(m["en"]), "qty": m["qty"]} for m in o["materials"]]
        if o.get("cat"): off["section"] = o["cat"]
        if o.get("day"): off["availability"] = WD[o["day"]]
        if o.get("note"): off.update(parse_note(o["note"]))
        offers.append(off)
        if not o.get("recipe"):
            e = ENT[(ITEM_FOLDER[iid], iid)]
            src = {"shop": sid, "price": o["gold"]}
            for k in ("materials", "currency", "season", "availability", "requiresBuilding", "fishingLevel"):
                if k in off: src[k] = off[k]
            e.setdefault("soldAt", []).append(src)
    SHOP_OFFERS[sid] = offers

# shop hours (shopSchedule.ts) -> light extraction of structured fields
sched_src = ts("shopSchedule.ts")
body = sched_src[sched_src.index("export const SHOP_SCHEDULE"):]
blocks = re.findall(r"\n  \{\n(.*?)\n  \},", body, re.S)
def hm_to_str(expr):
    m = re.fullmatch(r"hm\((\d+)(?:, (\d+))?\)", expr.strip())
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    return f"{h % 24:02d}:{mi:02d}" + (" (+1d)" if h >= 24 else "")
def ranges(txt):
    return [{"open": hm_to_str(a), "close": hm_to_str(b)} for a, b in re.findall(r"open: (hm\([^)]*\)), close: (hm\([^)]*\))", txt)]
SCHEDULE = {}
for b in blocks:
    sid = re.search(r'id: "(\w+)"', b).group(1)
    d = {}
    if m := re.search(r"\n    hours: (\{[^}]*\})", b): d["hours"] = ranges(m.group(1))[0]
    if m := re.search(r"keyHours: \[(.*?)\],", b, re.S): d["hoursWithKeyToTown"] = ranges(m.group(1))
    if m := re.search(r"boatHours: (\{[^}]*\})", b): d["hoursAfterBoatRepair"] = ranges(m.group(1))[0]
    for fld in ("closedDays", "closedDaysBeforeCC", "closedDaysAfterCC", "openSeasons", "openIfRainOnly"):
        if m := re.search(fld + r": \[([^\]]*)\]", b): d[fld] = re.findall(r'"(\w+)"', m.group(1))
    if m := re.search(r'festivalClose: "(\w+)"', b): d["festivalClosure"] = m.group(1)
    if "closedIfRain: true" in b: d["closedIfRain"] = True
    if "closesAfterCC: true" in b: d["closesPermanentlyAfterCommunityCenter"] = True
    if m := re.search(r"closedDates: \[(.*?)\]", b, re.S):
        d["closedDates"] = [{"season": s, "day": int(x)} for s, x in re.findall(r'season: "(\w+)", day: (\d+)', m.group(1))]
    # weekdayHours may be one line or a multi-line block (clinic); read every `day: { open, close }` inside it
    if m := re.search(r"weekdayHours: (\{[^\n]*\}|\{.*?\n    \}),", b, re.S):
        d["weekdayHours"] = {w: ranges(r)[0] for w, r in
                             re.findall(r"(\w+): (\{ open: hm\([^)]*\), close: hm\([^)]*\) \})", m.group(1))}
    if m := re.search(r"dateHours: \[(.*?)\n    \],", b, re.S):
        d["dateHours"] = [{"date": {"season": s_, "day": int(x)}, "hours": ranges(h)[0]} for s_, x, h in
                          re.findall(r'date: \{ season: "(\w+)", day: (\d+) \}, hours: (\{[^}]*\})', m.group(1))]
    SCHEDULE[sid] = d

# Night Market (winter 15-17): the scheduler has no dateHours for the cart. The rule is isNightMarket() in
# src/lib/reminders.ts and the hours are in messages/en.json reminders.travelingCart.detail ("5:00 PM-2:00 AM").
SCHEDULE["travelingCart"]["dateHours"] = [
    {"date": {"season": "winter", "day": day}, "hours": {"open": "17:00", "close": "02:00 (+1d)"}}
    for day in (15, 16, 17)]

for sid in sorted(set(SCHEDULE) | set(SHOP_OFFERS)):
    key = {"wizardTower": "wizard"}.get(sid, sid)
    en_name = (SCHED_EN.get(sid) or {}).get("name") or SHOP_NAME.get(key) or SHOP_NAME.get(sid)
    pt_name = (SCHED_PT.get(sid) or {}).get("name") or SHOP_NAME_PT.get(key) or SHOP_NAME_PT.get(sid)
    nm, ok = lname(en_name, pt_name, ctx=f"shops/{slug(sid)}")
    data = {"name": nm, "nameVerified": ok}
    if sid in SCHEDULE: data["schedule"] = SCHEDULE[sid]
    if sid in SCHED_EN:
        notes = {k: {"en": SCHED_EN[sid][k], "pt-BR": SCHED_PT.get(sid, {}).get(k)}
                 for k in ("open", "key", "boat", "closed", "festival", "checkup", "note") if k in SCHED_EN[sid]}
        data["scheduleText"] = notes; data["scheduleTextVerified"] = False
    if sid in SHOP_OFFERS: data["offers"] = SHOP_OFFERS[sid]
    put("shops", slug(sid), data)
for e in ENT.values():
    for s in e.get("soldAt", []): s["shop"] = slug(s["shop"])

# ============================================================ 4. villagers
bdays = {m[0]: (m[1], int(m[2])) for m in re.findall(r'villager: "(\w+)", season: "(\w+)", day: (\d+)', crop_src)}
MARRIAGEABLE = {"alex", "elliott", "harvey", "sam", "sebastian", "shane",
                "abigail", "emily", "haley", "leah", "maru", "penny"}
KO_TO_ITEM = {}
for members in CATS.values():
    for m in members: KO_TO_ITEM[m["ko"]] = m["en"]

CAT_BY_LABEL = {"All Vegetables": "vegetables"}
def gift_entry(e):
    if not e.get("cat") and e["en"] in CAT_BY_LABEL: e = {**e, "cat": CAT_BY_LABEL[e["en"]]}
    if e.get("cat"):
        exc = []
        det = e.get("detail") or ""
        paren = (re.search(r"\(([^)]*)\)", det) or [None, ""])[1] if "제외" in det else ""
        members = CATS.get(e["cat"], [])
        hits = [m for m in members if m["ko"] in paren]
        hits = [m for m in hits if not any(o is not m and m["ko"] in o["ko"] for o in hits)]
        exc = [item_id(m["en"]) for m in hits]
        r = {"category": slug(e["cat"])}
        if exc: r["except"] = exc
        return r
    return {"item": item(e["en"])}

def gift_block(g):
    out = {t: [gift_entry(e) for e in g[t]] for t in ("loves", "likes", "neutral")}
    if "avoidEn" in g: out["dislikesOrHates"] = [item(x) for x in g["avoidEn"]]
    return out

for vid in sorted(set(GIFTS) | set(bdays)):
    en_name, pt_name = msg("villagers", vid)
    nm, ok = lname(en_name, pt_name, ctx=f"villagers/{slug(vid)}")
    d = {"name": nm, "nameVerified": ok, "marriageable": vid in MARRIAGEABLE}
    if vid in bdays: d["birthday"] = {"season": bdays[vid][0], "day": bdays[vid][1]}
    if vid in GIFTS:
        d["gifts"] = gift_block(GIFTS[vid])
        for t in ("loves", "likes", "neutral"):
            for ge in d["gifts"][t]:
                if "item" in ge:
                    it = ge["item"]; e = ENT[(ITEM_FOLDER[it], it)]
                    e.setdefault("giftTastes", {}).setdefault(t, []).append(slug(vid))
        for it in d["gifts"]["dislikesOrHates"]:
            ENT[(ITEM_FOLDER[it], it)].setdefault("giftTastes", {}).setdefault("dislikesOrHates", []).append(slug(vid))
    if vid in MOVIES:
        d["movieTheater"] = {k: [item(x["en"]) for x in MOVIES[vid][k]]
                             for k in ("lovedMovies", "likedMovies", "lovedSnacks", "likedSnacks")}
    put("villagers", slug(vid), d)

put("gifts", "universal", gift_block(UNIV))
ENT[("gifts", "universal")]["description"] = {"en": EN["gift"]["universalHint"], "pt-BR": PT["gift"]["universalHint"]}
ENT[("gifts", "universal")]["tierLabels"] = {t: {"en": EN["gift"]["universal"][t], "pt-BR": PT["gift"]["universal"].get(t)} for t in ("loves", "likes", "neutral")}
for k, members in CATS.items():
    en_lbl, pt_lbl = EN["gift"]["categories"][k], PT["gift"]["categories"].get(k)
    put("categories", slug(k), {"name": {"en": en_lbl, "pt-BR": pt_lbl}, "nameVerified": False,
                                "note": "App UI label, not an in-game item name.",
                                "members": [item(m["en"]) for m in members]})

# ============================================================ 5. festivals
FEST_NO_LOCK = {"spiritsEve", "moonlightJellies", "desertFestival", "troutDerby", "squidFest", "nightMarket"}
for m in re.finditer(r'\{ id: "(\w+)", season: "(\w+)", day: (\d+)(?:, endDay: (\d+))? \}', crop_src):
    fid, season, day, end = m.groups()
    en_name, pt_name = msg("festivals", fid)
    nm, ok = lname(en_name, pt_name, ctx=f"festivals/{slug(fid)}")
    put("festivals", slug(fid), {"name": nm, "nameVerified": ok, "season": season,
                                 "startDay": int(day), "endDay": int(end or day),
                                 "shopsClosed": fid not in FEST_NO_LOCK})

# ============================================================ 5b. foraging events
# Source: src/lib/events.ts FORAGING_EVENTS (refId, season, day, endDay, icon name = item id).
for m in re.finditer(r'type: "foraging",\s*refId: "(\w+)",\s*season: "(\w+)",\s*day: (\d+),\s*endDay: (\d+),\s*icon: "/icons/bundleItems/(\w+)\.png"',
                     (REPO / "src/lib/events.ts").read_text(encoding="utf-8")):
    rid, season, day, end, icon = m.groups()
    en_name, pt_name = msg("foraging", rid)
    nm, ok = lname(en_name, pt_name, ctx=f"foraging-events/{slug(rid)}")
    put("foraging-events", slug(rid), {"name": nm, "nameVerified": ok, "season": season,
                                      "startDay": int(day), "endDay": int(end), "item": icon})

# ============================================================ 5c. reminders
# Source: src/data/reminders.ts REMINDERS + messages reminders.<id>.title/detail. Only these, in this order.
# specialOrders is every weekday in the scheduler; overridden to Monday (the weekly refresh day).
rem_src = ts("reminders.ts")
REMINDER_KEEP = [  # (scheduler id, trigger override)
    ("travelingCart", None), ("krobusSprinkler", None), ("desertTraderStaircase", None),
    ("queenOfSauceNew", None), ("queenOfSauceRerun", None),
    ("specialOrders", {"kind": "weekly", "weekdays": ["mon"]}), ("forageWeekly", None), ("buySeeds", None)]
for order, (rid, override) in enumerate(REMINDER_KEEP):
    m = re.search(r'\{\s*id: "' + rid + r'",\s*trigger: (\{.*?\}),?\s*(?:\n\s*(.*?))?\},?\n', rem_src, re.S)
    blk = m.group(0)
    tr = re.search(r'kind: "(\w+)"(?:, weekdays: \[([^\]]*)\])?', m.group(1))
    trigger = {"kind": tr.group(1)}
    if tr.group(2) is not None: trigger["weekdays"] = re.findall(r'"(\w+)"', tr.group(2))
    if override: trigger = override
    en_title, pt_title = msg(f"reminders.{rid}", "title"); en_det, pt_det = msg(f"reminders.{rid}", "detail")
    nm, ok = lname(en_title, pt_title, ctx=f"reminders/{slug(rid)}")
    d = {"name": nm, "nameVerified": False, "detail": {"en": en_det, "pt-BR": pt_det}, "trigger": trigger, "order": order}
    if "nightMarketDaily: true" in blk: d["nightMarketDaily"] = True
    if "suppressOnFestival: true" in blk: d["suppressOnFestival"] = True
    put("reminders", slug(rid), d)

# ============================================================ 6. fish
for m in re.finditer(r'\{ id: "(\w+)", seasons: (ALL|\[[^\]]*\]), tool: "(\w+)", weather: "(\w+)"(?:, category: "(\w+)")?, windows: (\[\[.*?\]\]) \}', ts("fish.ts")):
    fid, seas, tool, weather, cat, wins = m.groups()
    seasons = ["spring", "summer", "fall", "winter"] if seas == "ALL" else re.findall(r'"(\w+)"', seas)
    fe, fp = EN["fishInfo"][fid], PT["fishInfo"].get(fid, {})
    def hh(x): x = int(x); return f"{x % 24:02d}:00" + (" (+1d)" if x >= 24 else "")
    windows = [{"from": hh(a), "to": hh(b)} for a, b in json.loads(wins)]
    iid = item(fe["name"], fp.get("name"), folder="fish",
               catch={"tool": "crabPot" if tool == "crabpot" else "rod", "seasons": seasons,
                      "weather": weather, "timeWindows": windows,
                      "location": {"en": fe["location"], "pt-BR": fp.get("location")},
                      "locationVerified": False},
               **({"subtype": {"legendary": "legendary", "legendaryII": "legendary-ii", "nightMarket": "night-market"}[cat]} if cat else {}))

# ============================================================ 7. machines
mach_src = ts("machines.ts")
OUTPUT_EN = EN["machineOutputs"]; OUTPUT_PT = PT["machineOutputs"]
OUTPUT_ITEM = {"wine": "Wine", "juice": "Juice", "paleAle": "Pale Ale", "beer": "Beer", "pickles": "Pickles",
               "jelly": "Jelly", "honey": "Honey", "mead": "Mead", "cheese": "Cheese", "goatCheese": "Goat Cheese",
               "oil": "Oil", "diamond": "Diamond", "emerald": "Emerald", "ruby": "Ruby", "jade": "Jade",
               "aquamarine": "Aquamarine", "amethyst": "Amethyst", "topaz": "Topaz", "mapleSyrup": "Maple Syrup",
               "oakResin": "Oak Resin", "pineTar": "Pine Tar", "batteryPack": "Battery Pack"}
SPECIAL_OUT = {"slimeHatch": "slime", "ostrichHatch": "ostrich"}
mach_recipes = {}
for blk in re.findall(r"\{\s*(?://[^\n]*\n\s*)*id: \"(\w+)\",\s*category: \"(\w+)\",\s*recipes: \[(.*?)\],\s*\}", mach_src, re.S):
    mid, cat, rec = blk
    mach_recipes[mid] = (cat, [(r, int(d)) for r, d in re.findall(r'id: "(\w+)", days: (\d+)', rec)])
CRAFT_EN = EN["perfectionItems"]["crafting"]
for mid, en_name in EN["machines"].items():
    pt_name = PT["machines"].get(mid)
    cat, recs = mach_recipes.get(mid, (None, []))
    d = {}
    if cat: d["category"] = cat
    if recs:
        d["processing"] = []
        for r, days in recs:
            p = {"days": days}
            if r in OUTPUT_ITEM: p["output"] = item(OUTPUT_ITEM[r])
            else: p["output"] = SPECIAL_OUT.get(r, r)
            p["label"] = {"en": OUTPUT_EN[r], "pt-BR": OUTPUT_PT.get(r)}
            if mid == "cask": p["note"] = "daysToIridiumQuality"
            d["processing"].append(p)
    item(en_name, pt_name, folder="machines", **d)

# ============================================================ 8. buildings
bsrc = ts("buildings.ts")
BUILD_EN = {"stable": "Horse Stable", "logCabin": "Log Cabin Stage 1", "shippingBin": "ShippingBox",
            "farmhouse1": "House (tier 2)", "farmhouse2": "House (tier 3)", "farmhouse3": "House (tier 4)"}
for m in re.finditer(r'\{ id: "(\w+)", category: "(\w+)", gold: (\d+), buildDays: (\d+)(?:, requires: "(\w+)")?, materials: \[(.*?)\] \}', bsrc):
    bid, cat, gold, days, req, mats = m.groups()
    en_name = BUILD_EN.get(bid) or EN["buildings"][bid]
    mats_l = [{"item": item(EN["materials"][k], PT["materials"].get(k)), "qty": int(q)}
              for k, q in re.findall(r'id: "(\w+)", qty: (\d+)', mats)]
    req_id = item_id(BUILD_EN.get(req) or EN["buildings"][req]) if req else None
    item(en_name, PT["buildings"].get(bid), folder="buildings", category=cat,
         construction={"price": int(gold), "materials": mats_l, "buildDays": int(days), "upgradeFrom": req_id,
                       "builtBy": "carpenter"})
for n in ("Earth Obelisk", "Water Obelisk", "Desert Obelisk", "Island Obelisk", "Gold Clock", "Junimo Hut"):
    iid = item(n); e = ENT[("buildings", iid)]
    src = next((s for s in e.get("soldAt", []) if s["shop"] == "wizard-tower"), None)
    if src:
        e["construction"] = {"price": src["price"], "materials": src.get("materials", []), "builtBy": "wizard"}
        e["category"] = "magical"

# ============================================================ 9. animals
for off in SHOP_OFFERS["ranch"]:
    if ITEM_FOLDER[off["item"]] == "animals":
        e = ENT[("animals", off["item"])]
        e["purchase"] = {"shop": "ranch", "price": off["price"]}
        e["housing"] = off.get("requiresBuilding")
        e.pop("soldAt", None)

# ============================================================ 10. recipes
ING_CATEGORY = {
    "Any Fish": {"category": "fish"}, "Fish": {"category": "fish"},
    "Milk": None,
    "Milk (any)": {"category": "milk"},
    "Wild Seeds (any)": {"anyOf": ["spring-seeds", "summer-seeds", "fall-seeds", "winter-seeds"]},
}
ING_CATEGORY = {k: v for k, v in ING_CATEGORY.items() if v}
RECIPE_FIX = {
    "bananaPudding": ("Banana 1 Milk (any) 1 Sugar 1", {}),
    "crabPot": ("Wood 40 Iron Bar 3", {"alternatives": [{"condition": "trapperProfession",
                "ingredients": [{"item": "wood", "qty": 25}, {"item": "copper-bar", "qty": 2}]}]}),
    "skullBrazier": ("Bone Fragment 10", {"note": "Before v1.5: Hardwood 10, Solar Essence 1, Coal 1"}),
}
for kind in ("cooking", "crafting"):
    for rid, txt in EN["recipe"][kind].items():
        en_name = EN["perfectionItems"][kind][rid]
        pt_name = PT["perfectionItems"][kind].get(rid)
        recipe_extra = {}
        if rid in RECIPE_FIX: txt, recipe_extra = RECIPE_FIX[rid]
        ings = []
        for n, q in re.findall(r"(.+?) (\d+)(?= |$)", txt):
            n = n.strip()
            if n in ING_CATEGORY: ings.append({**ING_CATEGORY[n], "qty": int(q)})
            else: ings.append({"item": item(n), "qty": int(q)})
        f = "cooking" if kind == "cooking" else None
        iid = item(en_name, pt_name, folder=f if (en_name not in NAME_FOLDER and item_id(en_name) not in ITEM_FOLDER) else None)
        if ITEM_FOLDER[iid] == "misc-items" and kind == "crafting":
            # move craftable items without a folder to "craftables"
            e = ENT.pop(("misc-items", iid)); e["type"] = "craftables"
            ENT[("craftables", iid)] = e; ITEM_FOLDER[iid] = "craftables"
        ENT[(ITEM_FOLDER[iid], iid)][kind == "cooking" and "cookingRecipe" or "craftingRecipe"] = {"ingredients": ings, **recipe_extra}

# ============================================================ 11. collections
mus = re.findall(r'id: "(\w+)", ko: "[^"]*", en: "([^"]+)", icon: "[^"]*", cat: "(\w+)"', ts("museum.ts"))
for _, en_name, cat in mus:
    iid = item(en_name); ENT[(ITEM_FOLDER[iid], iid)]["museumDonation"] = True
put("collections", "museum", {"name": {"en": "Museum", "pt-BR": N.get("Museum", {}).get("pt-BR") or PT["museum"]["title"]},
                          "nameVerified": False,
                          "artifacts": [item_id(e) for _, e, c in mus if c == "artifact"],
                          "minerals": [item_id(e) for _, e, c in mus if c == "mineral"]})
fo = re.findall(r'en: "([^"]+)", icon: "[^"]*", qty: (\d+)', ts("fieldOffice.ts"))
put("collections", "field-office", {"name": {"en": EN["fieldOffice"]["title"], "pt-BR": PT["fieldOffice"]["title"]},
                                        "nameVerified": False,
                                        "donations": [{"item": item(n), "qty": int(q)} for n, q in fo]})

# ============================================================ 12. monster goals
for m in re.finditer(r'id: "(\w+)", ko: "[^"]*", en: "([^"]+)", count: (\d+), reward: \{ ko: "[^"]*", en: "([^"]+)"', ts("monsterGoals.ts")):
    gid, en_name, count, reward = m.groups()
    nm, ok = lname(en_name, ctx=f"monster-goals/{slug(gid)}")
    put("monster-goals", slug(gid), {"name": nm, "nameVerified": ok, "killsRequired": int(count),
                                       "reward": item(reward), "location": "adventurers-guild"})

# ============================================================ 13. bundles
def bundle_items(text):
    out = []
    for m in re.finditer(r'(qn\()?(crop|item|c|b)\("(\w+)"(?:, \[([^\]]*)\])?(?:, (true))?\)(?:, (\d+)\))?', text):
        _, kind, key, seas, rainy, qty = m.groups()
        ns = "crops" if kind in ("crop", "c") else "bundleItem"
        en_name, pt_name = msg(ns, key)
        if en_name is None: en_name, pt_name = msg("bundleItem" if ns == "crops" else "crops", key)
        if re.fullmatch(r"[\d,]+g", en_name or ""):
            out.append({"gold": int(en_name[:-1].replace(",", ""))}); continue
        e = {"item": item(en_name, pt_name)}
        if qty: e["qty"] = int(qty)
        s = re.findall(r'"(\w+)"', seas or "")
        if s: e["seasons"] = s
        if rainy: e["rainOnly"] = True
        out.append(e)
    return out

def calls(src):
    """Find all(...)/bundle(...) calls with balanced parentheses."""
    for m in re.finditer(r'(\.\.\.)?\b(all|bundle)\(\s*"', src):
        i = m.end() - 1; depth = 1; j = m.end() - 1
        j = src.index("(", m.start() + (3 if m.group(1) else 0)) + 1; depth = 1
        while depth:
            depth += {"(": 1, ")": -1}.get(src[j], 0); j += 1
        inner = src[src.index("(", m.start() + (3 if m.group(1) else 0)) + 1:j - 1]
        gold = False
        if m.group(1):
            close = src.find("}", j)
            gold = 'quality: "gold"' in src[j:close]
        yield inner, gold

def parse_bundles(src, remix):
    res = []
    for inner, gold in calls(src):
        mm = re.match(r'\s*"(\w+)",\s*"(\w+)",\s*\[(.*)\]\s*(?:,\s*(\d+)\s*)?,?\s*$', inner, re.S)
        if not mm: continue
        bid, room, body, needed = mm.groups()
        items_ = bundle_items(body)
        en_name, pt_name = msg("bundle", bid)
        official = GAME and GAME.bundle(en_name)
        if official:
            en_name, pt_name = official
        rn = msg("bundleRoom", room)
        b = {"name": {"en": en_name, "pt-BR": pt_name}, "nameVerified": bool(official),
             "room": {"id": slug(room), "name": {"en": rn[0], "pt-BR": rn[1]}},
             "remixed": remix, "slotsRequired": int(needed) if needed else len(items_), "items": items_}
        if gold: b["quality"] = "gold"
        res.append((bid, b))
    return res

bsrc_std = ts("bundles.ts")
bsrc_std = bsrc_std[bsrc_std.index("export const BUNDLES"):]
for bid, b in parse_bundles(bsrc_std, False):
    put("bundles", slug(bid), b)
    if not b["nameVerified"]:
        pending.append({"context": f"bundles/{slug(bid)}", "en": b["name"]["en"], "ptBrUnverified": b["name"]["pt-BR"]})
rsrc = ts("remixBundles.ts")
rsrc = rsrc[rsrc.index("export const REMIX_SLOTS"):]
for bid, b in parse_bundles(rsrc, True):
    put("bundles", slug(bid.replace("rx_", "remix-")), b)
    if not b["nameVerified"]:
        pending.append({"context": f"bundles/{slug(bid.replace('rx_', 'remix-'))}", "en": b["name"]["en"], "ptBrUnverified": b["name"]["pt-BR"]})

# ============================================================ 14. achievements
for aid, v in EN["achievements"].items():
    p = PT["achievements"].get(aid, {})
    official = GAME and GAME.name("achievements", v["name"])
    put("achievements", aid.replace("a", "achievement-"),
        {"order": int(aid[1:]), "name": {"en": v["name"], "pt-BR": official or p.get("name")},
         "description": {"en": v["desc"], "pt-BR": p.get("desc")}, "nameVerified": bool(official)})
    if not official:
        pending.append({"context": f"achievements/{aid}", "en": v["name"], "ptBrUnverified": p.get("name")})

# ============================================================ 15. perfection
perf_src = ts("perfection.ts")
perf_src = perf_src[perf_src.index("export const PERFECTION"):]
heads = list(re.finditer(r'id: "(\w+)", weight: (\d+), kind: "(\w+)"', perf_src))
GOAL_IDS = [slug(g) for g in re.findall(r'\{ id: "(\w+)", ko:', ts("monsterGoals.ts"))]
cats = []
for n, m in enumerate(heads):
    cid, w, kind = m.groups()
    rest = perf_src[m.end(): heads[n + 1].start() if n + 1 < len(heads) else len(perf_src)]
    c = {"id": cid, "weight": int(w), "kind": kind,
         "name": {"en": EN["perfectionCategory"][cid], "pt-BR": PT["perfectionCategory"].get(cid)}}
    ids = re.findall(r'\{ id: "(\w+)", icon', rest)
    if mx := re.search(r"max: (\d+)", rest): c["max"] = int(mx.group(1))
    if cid == "friends": c["villagers"] = [slug(i) for i in ids]
    elif cid == "monster": c["goals"] = GOAL_IDS
    elif cid in ("skill", "stardrop"):
        c["entries"] = [{"id": i, "label": {"en": EN["perfectionItems"][cid][i],
                                            "pt-BR": PT["perfectionItems"][cid].get(i)}} for i in ids]
    elif ids:
        c["items"] = [item(EN["perfectionItems"][cid][i], PT["perfectionItems"][cid].get(i)) for i in ids]
    cats.append(c)
put("perfection", "perfection", {"name": {"en": "Perfection", "pt-BR": PT["perfection"]["title"]},
                               "nameVerified": False, "categories": cats})

# ============================================================ meta + write
for (f, i), e in ENT.items():
    for k in ("soldAt",):
        if k in e:
            seen = []; [seen.append(x) for x in e[k] if x not in seen]; e[k] = seen
    gt = e.get("giftTastes")
    if gt:
        for t in gt: gt[t] = sorted(set(gt[t]))

for (f, i), e in ENT.items():
    if f == "buildings" and "construction" in e: e.pop("soldAt", None)
    c = e.get("construction")
    if c and c.get("upgradeFrom") is None: c.pop("upgradeFrom", None)

ORDER = ["id", "type", "subtype", "name", "nameVerified", "description", "tags"]

# Hand-made changes the scheduler source cannot reproduce live in ../overrides (see data_overrides.py).
_spec = importlib.util.spec_from_file_location("data_overrides", Path(__file__).with_name("data_overrides.py"))
data_overrides = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(data_overrides)
data_overrides.apply_overrides(
    ENT, data_overrides.load_overrides(Path(__file__).resolve().parents[1] / "overrides"), ORDER)

KEEP = {"README.md", "farms", "planner-objects"}  # the last two come from build_farm_maps.py
if OUT.exists():  # keep README.md and the farm planner folders, regenerate everything else
    for child in OUT.iterdir():
        if child.name not in KEEP:
            shutil.rmtree(child) if child.is_dir() else child.unlink()
counts = {}
for (f, i), e in sorted(ENT.items()):
    e = {k: e[k] for k in ORDER if k in e} | {k: v for k, v in e.items() if k not in ORDER}
    p = OUT / f / f"{i}.json"; p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(e, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts[f] = counts.get(f, 0) + 1

meta = OUT / "_meta"; meta.mkdir()
(meta / "locales.json").write_text(json.dumps({
    "default": "en", "available": LOCALES,
    "labels": {"en": "English", "pt-BR": "Português (Brasil)"}}, ensure_ascii=False, indent=2) + "\n")
ui = {k: {"en": EN[k], "pt-BR": PT[k]} for k in ("seasons", "weekdays")}
(meta / "enums.json").write_text(json.dumps(ui, ensure_ascii=False, indent=2) + "\n")
seen = set(); pend = []
for p in pending:
    # An override may have given the name its official translation since it was queued.
    if ENT.get(tuple(p["context"].split("/", 1)), {}).get("nameVerified"): continue
    if p["context"] not in seen: seen.add(p["context"]); pend.append(p)
(meta / "pending-translations.json").write_text(json.dumps(pend, ensure_ascii=False, indent=2) + "\n")
index = {f: sorted(i for (ff, i) in ENT if ff == f) for f in sorted(counts)}
for f in sorted(KEEP - {"README.md"}):  # still listed after a rebuild
    if (OUT / f).is_dir(): index[f] = sorted(p.stem for p in (OUT / f).glob("*.json"))
index = {f: index[f] for f in sorted(index)}
(meta / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(counts, indent=1), "total", sum(counts.values()), "pendentes", len(pend))
