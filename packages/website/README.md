# @stardew-valley-helper/website
This library was generated with [@aws/nx-plugin](https://github.com/awslabs/nx-plugin-for-aws/).

## Building

Run `pnpm nx build @stardew-valley-helper/website [--skip-nx-cache]` to build the application.

## Run dev server

Run `pnpm nx serve @stardew-valley-helper/website`

## Running unit tests

Run `pnpm nx test @stardew-valley-helper/website` to execute the unit tests via Vitest.

### Updating snapshots

To update snapshots, run the following command:

`pnpm nx test @stardew-valley-helper/website --configuration=update-snapshot`

## Run lint

Run `pnpm nx lint @stardew-valley-helper/website`

### Fixable issues

You can also automatically fix some lint errors by running the following command:

`pnpm nx lint @stardew-valley-helper/website --configuration=fix`

### Runtime config

In order to integrate with cognito or trpc backends, you need to have a `runtime-config.json` file in your `/public` website directory. You can fetch this is follows:

`pnpm nx load-runtime-config @stardew-valley-helper/website`

> [!IMPORTANT]
> Ensure you have AWS CLI and curl installed
> You have deployed your CDK infrastructure into the appropriate account
> You have assumed a role in the AWS account with sufficient permissions to call describe-stacks from cloudformation

## Game icons

`public/icons/` is generated: do not edit it by hand. It holds the Stardew Valley sprites from the
`stardew-valley-scheduler` project, renamed to the game-data ids (`<id>.png`), plus `ui/` for images
that match no id, `variants/<folder>/` for the other copies of an id's sprite (other folders or
sizes, kept for future use) and `NOTICE.txt` (© ConcernedApe, non-commercial fan use). The ids with an image go
to `src/lib/icon-manifest.json`. To regenerate it, from the repository root:

```bash
python3 -I packages/website/scripts/sync_icons.py \
  .tmp/stardew-valley-scheduler/public/icons \
  packages/db/data/_meta/index.json
```

`.tmp/stardew-valley-scheduler` is a local, git-ignored copy of the community scheduler project and
`packages/db/data` the versioned game dataset.

The script prints the ids still without an image and the files an override replaced. Fix a name that does not match in
`scripts/icon-overrides.json` (id → source path). Script tests:
`uv run pytest packages/website/scripts`.

## Useful links

- [React website reference docs](TODO)
- [Learn more about NX](https://nx.dev/getting-started/intro)
