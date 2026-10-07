# Render website hosting

Render hosts the Vite-built React website as a static site. The API, worker, and
PostgreSQL/PostGIS database remain in AWS. The root [render.yaml](../render.yaml)
defines the frontend build and single-page-app route fallback.

## Create the Render site

1. Push the repository branch containing `render.yaml` and the frontend changes to
   GitHub. In Render, choose **New > Blueprint**, connect `ryanfer123/DBTHON-26`, and
   select that branch.
2. When Render prompts for `VITE_API_BASE_URL`, enter the AWS API's public HTTPS URL
   ending in `/api/v1`, for example `https://api.example.com/api/v1`. This value is
   compiled into the browser bundle and must not contain credentials or secrets.
3. Render builds from `frontend` with `npm ci && npm run build`, then publishes
   `dist`. Its rewrite sends client-side routes such as `/account` and `/admin` to
   `index.html`.
4. Use the exact HTTPS site origin Render assigns (for example,
   `https://dbthon-26-web.onrender.com`) when configuring the AWS API. If a custom
   domain is added, use that exact origin instead.

## AWS API settings for the Render origin

The browser calls the AWS API directly. Set the API's production environment to
allow only the deployed site origin:

```text
APP_ENV=production
ALLOWED_ORIGINS=["https://dbthon-26-web.onrender.com"]
```

The API must deploy the repository's credentialed CORS and cookie support along
with the frontend. CORS allows the explicit origin, credentials, and the app's
required headers. Production session cookies use `Secure; SameSite=None`; write
requests still require the session CSRF token and the `X-Requested-With` header.
Never use `*` for allowed origins. Update `ALLOWED_ORIGINS` whenever the website
origin changes, then redeploy the API.

For reliable browser sign-in, use custom domains under the same registrable domain,
such as `app.example.com` and `api.example.com`. A Render `onrender.com` site calling
an AWS service domain is cross-site; some browsers block its third-party session
cookie even with `SameSite=None`.

## Deployment boundary

This Blueprint creates only the static website. It does not create or change AWS
resources. The AWS API needs a public HTTPS endpoint reachable by browsers. Keep
database credentials, session secrets, and private AWS endpoints out of
`VITE_API_BASE_URL`; Vite embeds this value in public JavaScript. Registration and
sign-in will work only after the AWS API has the exact Render origin in its allowlist
and the API health endpoint is reachable.
