# Bloom

Bloom is a Vite + React app for an AI phone-style relationship experience.

Deployment trigger note: this line keeps Pages deployment checks attached to a non-empty commit.

## Scripts

- `npm run dev`: start the local app server
- `npm run lint:compat`: audit regex syntax against the legacy Safari/iOS WebView compatibility boundary
- `npm run build`: run the regex audit and build the frontend bundle
- `npm run preview`: preview the Vite build
- `npm run cf:deploy:pages`: build and deploy to Cloudflare Pages
- `npm run cf:dev:pages`: preview the Pages build locally
- `npm run lint`: run the regex audit and TypeScript type-checking

## Compatibility Guardrails

Bloom still targets older Safari and iOS WebView builds via `@vitejs/plugin-legacy` in `vite.config.ts`.

To keep that boundary intact, `npm run lint:compat` blocks regex syntax that those environments do not support, including lookbehind, named capture groups, and named backreferences.

## Project Layout

```text
.
|- src/          frontend application
|- docs/         product and architecture docs
|- app/          reserved app directory
|- server.ts     local server entry
|- package.json
`- vite.config.ts
```

## Docs

- [Product Introduction](./docs/product-introduction.md)
- [Full PRD](./docs/full-ai-product-prd.md)
- [Project Architecture](./docs/project-architecture.md)
- [Job Product Introduction](./docs/job-product-introduction.md)
- [Memory System V1 Runtime Status](./docs/memory-system-v1-runtime-status.md)
