# Contributing

Thank you for considering contributing to this repository.

## How to Contribute

1. **Check existing issues** - See if someone is already working on it
2. **Open an issue first** - Discuss your idea before starting work
3. **Fork and create a branch** - Use a descriptive name like `feat/foo`
4. **Keep PRs focused** - One logical change per PR
5. **Document your changes** - Update METHODOLOGY.md or DATA_DICTIONARY.md if you touch data or scripts

## Commit Conventions

All commits use Conventional Commits, must be GPG or SSH signed, and
must include a DCO sign-off:

```bash
git commit -S --signoff -m "feat(scope): description"
```

Accepted types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`,
`perf`, `data`.

By signing off, you certify that your contribution is your own work or
you have the right to submit it under the Apache-2.0 license
([DCO](https://developercertificate.org)).

## Local Validation

Requires [bun](https://bun.sh). There is no package.json; scripts run
directly.

Validate the dataset integrity (file counts, naming, schema, summary
consistency):

```bash
bun scripts/validate-data.ts
```

Regenerate a batch summary from run JSONs:

```bash
bun run scripts/webmcp-eval/summarize.ts --run-dir docs/audit/<batch>/runs --out docs/audit/<batch>/summary.md
```

Where `<batch>` is one of `baseline`, `delta`, or `delta-rerun`.

Rebuild the payload audit JSON:

```bash
bun scripts/audit-webmcp-payloads.ts
```

## Figures

Figures are rendered from typed data modules in `data/charts/`. Edit the
data module, then re-render the corresponding SVG in `figures/` and
commit both together. CI validates that figure references resolve and
that summary numbers match the run data, so a stale figure or summary
will fail the build.

## Data Files

Run JSON files under `docs/audit/*/runs/` are recorded observations and
are treated as immutable. Do not edit them by hand. If a data error is
found, open an issue describing the discrepancy and the expected fix
(re-record, annotate in results, or correct derived files).

## License

By contributing, you agree that your contributions are licensed under
the Apache-2.0 license of this repository.
