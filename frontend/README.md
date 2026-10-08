# Frontend

NomNom's responsive React, TypeScript, and Vite frontend. Render builds this
directory as a static site; `render.yaml` configures its build, publish path, and SPA
route fallback. The production API remains on AWS and is selected with
`VITE_API_BASE_URL`. The public landing page has a richer reference-inspired visual
story; role workspaces keep the shared brand and focus on quick, clear tasks.

From the repository root, run `npm ci --prefix frontend` and
`npm run dev --prefix frontend` for local development. Root Make targets cover
linting, type checking, unit tests, production build, and browser checks. See
[development](../docs/DEVELOPMENT.md), [UX specification](../docs/UX.md), and
[Render deployment](../docs/RENDER_DEPLOYMENT.md).
The frontend redesign scope and its implementation record are in
[the migration plan](../docs/FRONTEND_MIGRATION_PLAN.md) and
[the design approval register](../docs/design/APPROVED_DESIGNS.md).
