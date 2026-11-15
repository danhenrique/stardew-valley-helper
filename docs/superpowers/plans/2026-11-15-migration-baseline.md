# Migration baseline (aws-danhenrique @ ffd52b7, 2026-11-15)

Measured in `aws-danhenrique` before any change. Every gate in the migration plan compares against
these numbers.

## Tests

| Project | Command | Result |
|---|---|---|
| `aws_danhenrique.stardew_valley_api` | `uv run pytest --collect-only -q` | 146 tests collected, all pass |
| `aws_danhenrique.stardew_valley_db` | `uv run pytest --collect-only -q` | 66 tests collected, all pass |
| `@aws-danhenrique/stardew-valley-helper-website` | `nx test --watch=false` | 69 files, 575 tests passed |
| `@aws-danhenrique/stardew-valley-infra` | `nx test` (terraform test) | 3 passed, 0 failed |

## Checkov

| Project | Passed | Failed | Skipped |
|---|---|---|---|
| `@aws-danhenrique/stardew-valley-infra` | 133 | 0 | 40 |
| `@aws-danhenrique/terraform` (includes the personal website modules) | 163 | 0 | 46 |

## Import dry run (`--data-dir .tmp/data --dry-run`)

Total 5580 items:

```json
{"GameMeta":2,"Animal":7,"Item":812,"Recipe":211,"Ingredient":503,"Produces":85,"Category":16,"Member":465,"Collection":2,"Achievement":49,"Building":25,"ForagingEvent":3,"Festival":12,"Movie":8,"Reminder":8,"Shop":19,"ShopOffer":373,"MonsterGoal":12,"Bundle":71,"BundleRequirement":326,"Perfection":1,"Villager":34,"GiftTaste":1823,"MovieTaste":712,"UniversalGifts":1}
```

The run also logs 8 dataset corrections, 3 source differences and the dry-run line (12 log lines in total). The port
must reproduce the same 12 lines, ignoring timestamps.

## OpenAPI

`dist/packages/stardew-valley/api/openapi/openapi.json`: 229,772 bytes. The port must produce a
byte-identical file.

## Production plan

Not measured yet: no AWS credentials were available. It runs before the state cutover (Task 8), and
`No changes.` is required there.
