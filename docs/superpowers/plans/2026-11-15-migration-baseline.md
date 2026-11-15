# Migration baseline (aws-danhenrique @ ffd52b7, 2026-11-15)

Measured in `aws-danhenrique` before any change. Every gate in the migration plan compares against
these numbers.

## Tests

| Project | Command | Result |
|---|---|---|
| `aws_danhenrique.stardew_valley_api` | `uv run pytest --collect-only -q` | 146 tests collected: 145 passed, 1 skipped (`test_should_match_dataset_last_planting_day_when_seed_has_phases_and_one_season`, dataset path missing in OLD) |
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

`dist/packages/stardew-valley/api/openapi/openapi.json`: 29,772 bytes. The port must produce a
byte-identical file.

## Production plan

`pnpm nx run @aws-danhenrique/stardew-valley-infra:plan` (profile `danhenrique-prod`), measured the
same day:

```
Plan: 14 to add, 23 to change, 14 to destroy.
```

The plan is never empty. It only shows three patterns that come back on every plan, and no real
resource is created, destroyed or replaced:

- **Runtime config redeploy.** These are replaced on every apply:
  - `null_resource.aggregate_namespace` (4 entries + 1 in the website)
  - `aws_appconfig_hosted_configuration_version.namespace` (4)
  - `aws_appconfig_deployment.namespace` (4)
  - `null_resource.cloudfront_invalidation`

  This also updates `runtime-config.json` in place.
- **AWS normalization.**
  - `aws_api_gateway_rest_api_policy.api_policy`: `execute-api:/*` vs the full ARN.
  - `cors_4xx` / `cors_5xx`: the `response_templates` default.
- **Lambda zip rebuilt locally.** `aws_s3_object.lambda_zip` gets a new etag, so the 18
  `aws_lambda_function.api_lambda[*]` are updated in place.

No website bundle object changes: the built bundle equals the deployed one. The 44 action lines are
the gate for the state cutover (plan Task 8, Step 4).
