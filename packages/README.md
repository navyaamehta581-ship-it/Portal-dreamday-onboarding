# Planned host packages

Reserve `packages/app` and `packages/backend` for a single agreed Backstage host's frontend and backend wiring. No host has been scaffolded yet; there are no package manifests or executable packages in this directory.

Before generating: record the target Backstage version, frontend system, backend API compatibility, Node/package-manager versions, and managed Portal extension/deployment permissions. Use the actual host generator and lockfile conventions. Custom feature packages belong under `plugins/`.

Reference: [Backstage project structure](https://backstage.io/docs/contribute/project-structure/).
