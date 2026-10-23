# Validation for blueprint adoption

Baseline: `9cd4082031571129165b4f249c9a33a9ea1430a2`; branch `docs/managed-portal-blueprint`; date 23 October 2026. Validation below applies to the adoption changes and preserved V1. Runtime: Node 26.0.0, npm 11.12.1, Python 3.13 locally; CI uses Node 24.

- `npm ci --prefix prototypes/v1`: PASS; 100 locked packages installed. No lockfile change.
- `npm test --prefix prototypes/v1`: PASS; 39 tests in 4 files.
- `npm run build --prefix prototypes/v1`: PASS; TypeScript and Vite production build (1,666 modules).
- `python3 scripts/validate_blueprint.py`: PASS; snapshot hashes, 516 unique IDs, 355 retained IDs, complete acyclic dependencies and mutable tracker consistency.
- Relative-link existence check for adoption documents: PASS.
- `git diff --exit-code -- prototypes/v1 examples V1_SOURCE_HANDOFF.zip docs/v1`: PASS; preserved content unchanged.
- `git diff --check`: PASS.

The feature PR adds the blueprint check to existing V1 CI; GitHub run status must be checked on the actual PR head. No local result is represented as a GitHub CI result. No managed Portal integration, tenant compatibility, publishing or production execution checks are available.
