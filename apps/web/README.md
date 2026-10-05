# Second Table web interface

P01 implements a React/TypeScript/Vite public screen with API-provided role content,
accessible tabs, route-backed selection, deep-link refresh, and failure/retry.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

API must run on localhost:8000; Vite proxies `/api`. The browser tests require
PostgreSQL/PostGIS plus installed Chrome locally (Chromium in CI).
Working screen design: [concept](../../docs/design/README.md).
Account/listing/claim/volunteer/admin screens in [UX](../../docs/UX.md) remain to build.
This public screen does not simulate donations or expose real contact details.
