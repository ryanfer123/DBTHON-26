# Frontend

Responsive React, TypeScript, and Vite application. Render builds this directory as
a static site; `render.yaml` configures its build, publish path, and SPA route
fallback. The production API remains on AWS and is selected with
`VITE_API_BASE_URL`.

From the repository root, run `npm ci --prefix frontend` and
`npm run dev --prefix frontend` for local development. Root Make targets cover
linting, type checking, unit tests, production build, and browser checks. See
[development](../docs/DEVELOPMENT.md), [UX specification](../docs/UX.md), and
[Render deployment](../docs/RENDER_DEPLOYMENT.md).
