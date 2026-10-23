# Cross-package tests

Existing V1 unit tests live in `prototypes/v1/src/logic/*.test.ts` and run with `npm test` from that directory. Keep native V2 unit tests colocated with their packages.

`integration/` and `e2e/` currently contain acceptance plans, not automated tests or an installed test runner. Add executable tests and CI commands with the relevant host/plugin implementation. Do not report these plans as passing tests.
