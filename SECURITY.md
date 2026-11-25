# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub:
**Security → Report a vulnerability** on this repository
([direct link](https://github.com/danhenrique/stardew-valley-helper/security/advisories/new)).

Include what you found, how to reproduce it and what impact you expect. You will get an answer as soon
as possible; this is a hobby project maintained by one person, so please allow a few days.

## Scope

- The website at `https://stardew.danhenrique.com.br`, its API and its login.
- The code and the CI workflows in this repository.

Do not test against other players' data, do not run load or denial-of-service tests, and do not use
automated scanners that send large volumes of requests to the live site.

## Secrets

If you find a secret committed to this repository, report it privately as above. It will be rotated,
not just removed from the history.
