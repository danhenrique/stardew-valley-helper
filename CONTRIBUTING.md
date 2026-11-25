# Contributing

Thanks for helping other Stardew Valley players! Fixes to game data, translations, bug reports and
website improvements are all welcome. Issues and pull requests in Portuguese are welcome too.

## Before you start

- **Small fix?** Open a pull request directly.
- **New feature or a large change?** Open an issue first, so we can agree on the approach before you
  spend time on it.
- **Security problem?** Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Ways to contribute

### Game data and translations

The game dataset lives in `packages/db/data/`, one JSON file per resource
(see [`packages/db/data/README.md`](packages/db/data/README.md) for the conventions).

`data/` is **generated** by `packages/db/scripts/build-data.py`, so do not edit it by hand: put the
change in `packages/db/overrides/<folder>/<id>.json` (same layout as `data/`) and regenerate. See
"Hand-made changes" in [`packages/db/README.md`](packages/db/README.md).

Regenerating needs a local copy of the community
[stardew-valley-scheduler](https://github.com/LDaham/stardew-valley-scheduler) in `.tmp/`:

```bash
git clone https://github.com/LDaham/stardew-valley-scheduler .tmp/stardew-valley-scheduler
python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data
git diff packages/db/data   # must show only the change you meant
```

pt-BR texts still waiting for a check against the official translation are listed in
`packages/db/data/_meta/pending-translations.json`. Please cite your source (the game files or
[pt.stardewvalleywiki.com](https://pt.stardewvalleywiki.com)) in the pull request.

### Website and API

- `packages/website/`: React website. Styling uses **Tailwind CSS utility classes only**, icons come
  from **Heroicons** (`@heroicons/react`), every page works in **light and dark** themes, and every
  user-facing text exists in **English and pt-BR**. Icon-only buttons need an `aria-label` and the
  same text in `title`.
- `packages/api/`: FastAPI REST API.

## Local setup

Requirements: Node.js 24, [pnpm](https://pnpm.io), [uv](https://docs.astral.sh/uv/) (Python), and
Docker only if you want DynamoDB Local.

```bash
pnpm install
pnpm nx dev @stardew-valley-helper/website   # website + API + DynamoDB Local; login is mocked
```

Tests mock DynamoDB, so they do not need Docker or an AWS account:

```bash
pnpm nx run-many -t lint test typecheck
```

You never need AWS credentials to contribute. Deploys are done by the maintainer only.

## Pull requests

1. Fork the repository and create a branch named `feature/<short-description>` (or
   `fix/<short-description>`) from `main`.
2. Keep each pull request focused on one change.
3. Add or update tests for code changes, and make sure `lint`, `test` and `typecheck` pass.
4. Fill in the pull request template.

### Protected paths

Some paths can run code on the maintainer's machine, in CI or in AWS, or steer AI coding tools:
editor and AI tool settings (`.claude/`, `.mcp.json`, `.cursor/`, `CLAUDE.md`, …), git hooks, CI
workflows, infrastructure (`packages/infra/`, `packages/common/terraform/`), dependency and build files
(`package.json`, `project.json`, lockfiles, `scripts/`). The full list is in
[`.github/CODEOWNERS`](.github/CODEOWNERS).

A pull request that changes them fails the **Protected paths** check. That does not mean it is
rejected: it means the maintainer has to review it more carefully and merge it by hand. If your change
needs a new dependency or a script change, say why in the description.

## Rules for every contribution

- **No secrets** (keys, tokens, passwords, AWS account ids) and **no real personal data** (e-mails,
  phone numbers, addresses, documents) anywhere: code, tests, fixtures, examples, logs, commits.
  Use made-up data.
- **Game assets:** sprites, maps and game data are © ConcernedApe LLC, and parts of the data come
  from the Stardew Valley Wiki (CC BY-NC-SA 3.0). Only add assets that can be used for
  non-commercial fan purposes, and say where they came from.
- By contributing, you agree that your code is released under the repository's
  [MIT License](LICENSE).

## AI coding tools

The repository includes settings for AI coding tools (`CLAUDE.md`, `.claude/`, `.mcp.json`, …).
Using them is optional. If you do, read them first: they run commands on your machine.
