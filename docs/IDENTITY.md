# Identity implementation and local use

P03 implements registration, login/logout, self-profile reads/updates, zone listing,
zone-admin user listing and requested-role verification. Alembic revision `0002`
extends `0001`; no published baseline was rewritten. Connected account screens
arrive in P09; the public welcome screen remains the current frontend.

## Configure local access

```sh
make setup install db-up migrate db-access
make dev
```

`make db-access` generates separate `dbthon_app` and `dbthon_identity` LOGIN
credentials, saving only ignored mode-0600 connection URLs. It preserves existing
configured URLs. Runtime has only dbthon_runtime membership; identity has only
dbthon_auth membership, both with INHERIT FALSE/SET TRUE. They cannot become guard,
owner or superuser. Every transaction verifies the login attributes/memberships,
sets its role locally and sets session/CSRF context locally. A URL pointing at the
bootstrap owner fails closed. Missing restricted configuration makes readiness 503.
Production requires explicit HTTPS ALLOWED_ORIGINS and Secure cookies; the local
provisioner refuses APP_ENV=production. Deployment provisioning is separate work.

Synthetic fixture users initially cannot log in. After seeding, enable a local
fixture account with a password entered through getpass (12-128 characters):

```sh
uv run --project apps/api python scripts/demo_password.py --user 104
```

Examples: 101 donor, 102 receiver, 103 volunteer, 104 zone-1 admin. The command
accepts only supplied synthetic IDs in a seeded development/test DB, hashes the
password, revokes that user's sessions and appends a labelled synthetic event.
It prints no password and grants no new roles. Admin registration is never public.

## Request protocol

All unsafe identity requests need `X-Requested-With: SecondTable`. When Origin is
present it must exactly match ALLOWED_ORIGINS; cross-site Fetch Metadata is denied.
No cross-origin CORS permission is enabled. This also protects login/registration.

Login returns `data.user` and `data.csrf_token` and sets a host-only HttpOnly
`dbthon_session` cookie (SameSite=Lax, Path=/api/v1, 12-hour expiry; Secure in
production). Preserve the cookie using a cookie jar or fetch credentials. All
authenticated writes additionally need `X-CSRF-Token` from login or GET /auth/me.
The server derives this token from the opaque session with a domain separator;
the database stores only its SHA-256 digest and the session's SHA-256 digest.
The CSRF token does not expose the raw session. Login rotates the caller's previous
session for that identity; at most five simultaneous sessions remain active.
Logout revokes server-side state before clearing the cookie. Expired/revoked and
inactive-user sessions fail even if a browser still sends the cookie.

Passwords use Argon2id, 64 MiB memory, three passes and parallelism four, with
per-password salts and rehash on login when settings change. Login errors for
unknown/disabled/inactive/wrong-password accounts use one safe 401 message; unknown
and disabled hashes perform a dummy verification. Persistent database limits are
20 login attempts/IP/minute, eight/email/minute, five registrations/IP/minute.
They count all attempts, commit before authentication and return 429/Retry-After.
The app uses request.client.host; it does not trust arbitrary forwarded headers.

## Verification and privacy

Registration normalizes email/name, requires positive capacity for Receiver, rejects
duplicate roles and Admin/approved/active flags. Public roles are Donor, Receiver,
Volunteer; they start pending. Profile updates allow only name, phone, coordinates
and Receiver capacity. Zone, roles and verification cannot be patched by a user.

Approved zone Admins can list their own zone's users and replace approval of requested
public roles. They cannot invent an unrequested role, grant Admin, or access another
zone by ID/filter. Revocation clears approvals and immediately removes capabilities;
it preserves identity/history. Bootstrap Admin membership is maintained separately.

Own/admin profile DTOs contain the contacts needed for that authorized operation;
public zones contain names/cities only. Password hashes/session rows never appear in
DTOs. Errors omit submitted inputs and SQL/driver text, including validation errors
that would otherwise echo a password. Identity/admin responses use private/no-store.
Ledger payloads contain IDs, role/status changes and changed-field names, without
contacts, password/session/CSRF hashes or free-text review reasons. Reasons are in
private FORCE-RLS verification_reviews, visible only to self/scoped Admin.

Writes commit before returning an HTTP success. Registration, profile and verification
changes append events and pending notifications in the same transaction. Login/logout
append session-state audit events without pretending to deliver external alerts.

References: [Argon2 API](https://argon2-cffi.readthedocs.io/en/stable/api.html),
[OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[PostgreSQL role grants](https://www.postgresql.org/docs/17/sql-grant.html).
