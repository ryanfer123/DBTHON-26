# AWS API connection for the Render frontend

The approved connection reuses the retained private RDS PostgreSQL instance in
`ap-south-1`. It does not update or delete the older failed `DbthonPrototype` stack,
create a replacement database, or copy local member data. The new stack is
`DbthonRenderApi`, defined by `deploy/aws-lambda/template.json`.

## Runtime and security

- Render continues hosting the React frontend. `VITE_API_BASE_URL` is the deployed
  AWS Function URL plus `/api/v1`; a new frontend build is required after changing it.
- AWS Lambda adapts the existing FastAPI application with Mangum. Public Function
  URL access exposes the application's public routes; private routes retain opaque
  sessions, verified roles, zone-scoped database checks, CSRF and idempotency guards.
- Production cross-origin cookies use `Secure; HttpOnly; SameSite=None`. Credentialed
  CORS and write-origin checks allow only the exact Render origin. Browsers which
  block third-party cookies can restrict this split-host arrangement; a shared-site
  custom domain or same-origin frontend remains the longer-term option.
- API, worker and operator initialization use separate Lambda functions and IAM
  execution roles. The API receives auth/runtime login credentials, the worker only
  its worker login, and only the private operator initializer receives the RDS owner.
  No Function URL is attached to the operator or worker.
- RDS remains private. A dedicated Lambda security group permits PostgreSQL traffic
  to the existing database security group; no public database rule is added.
- CloudFormation Secrets Manager dynamic references supply credentials without
  committing plaintext. RDS manages the rotated owner credential. Restricted login
  secrets contain only generated alphanumeric passwords matching provisioning rules.
  Changing a restricted login secret requires coordinated database provisioning and
  Lambda configuration refresh; automatic restricted-login rotation is not configured.

## Database initialization

Migration 0004 keeps the private `dbthon_guard` function owner non-login and without
BYPASSRLS, supplying explicit guard policies under FORCE RLS. Initial preparation
provides schema CREATE rights needed for function ownership changes; 0004 revokes
those rights. A non-superuser creator inherits the guard's privileges during
migration. Runtime connection checks reject owners and members of the guard role.

`deploy/aws-lambda/bootstrap.py` requires an explicit `initialize` operator event.
It refuses unknown pre-existing tables, applies authoritative Alembic/SQL migrations,
imports the existing clearly synthetic fixture set idempotently, and provisions
separate restricted logins. It never truncates a live database or imports the local
workspace database. Existing application content is preserved by the seed guard. Repeated initialization
reuses the recorded fixture anchor. Sequence UPDATE is granted to the guard only
inside the fixture transaction and revoked before commit; schema CREATE is revoked
on every initialization, including when migrations were already applied.

The managed owner secret is rotated automatically by RDS; an operator initializer
must refresh its CloudFormation configuration before a later invocation if the
owner secret has rotated. The API/worker never use that owner secret.

## Worker and operational limits

An EventBridge minute schedule invokes the worker for up to 50 seconds, sweeping
at the configured five-second interval. The API always rechecks expiry against
database time even between sweeps. Retries and failed inbox/outbox states remain
implemented in PostgreSQL. Worker invocation failures have a retained encrypted
SQS dead-letter queue. CloudWatch logs retain 14 days; long-term alarms and heartbeat
monitoring remain follow-up work. Concurrency is bounded to five API invocations and
one worker invocation to limit small-instance database connection pressure.

This is a controlled prototype topology. It retains the existing single-AZ database
and can incur Lambda, Secrets Manager, logging, queue and existing RDS charges.
No cost or availability guarantee is made.

## Build and release

```sh
docker build --platform linux/amd64 -f deploy/aws-lambda/Dockerfile -t dbthon-lambda:connect .
aws cloudformation validate-template --template-body file://deploy/aws-lambda/template.json --profile ryan --region ap-south-1
```

Package `/package` from the image as a ZIP, upload under a checksum-addressed key in
the existing private artifact bucket, and create/review a change set with
`Activate=false`. Supply existing VPC/subnet/database metadata and the managed owner
secret ARN as parameters. These are infrastructure references, not plaintext secrets.

After the operator invocation returns successful initialization, check the restricted
worker, update with `Activate=true`, and verify public readiness and community routes.
Then merge the AWS HTTPS API base into the Render environment, rebuild, and verify
actual browser registration/sign-in, CSRF and session continuity. Record actual
results in [STATUS.md](STATUS.md); a valid template is not live-connection evidence.

Primary references: [Function URL permissions](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html),
[RDS managed passwords](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html),
[ASGI adapter](https://mangum.fastapiexpert.com/adapter/).

## Browser smoke reproduction

With the web's locked dependencies and Chrome installed, run:

```sh
DBTHON_LIVE_SMOKE=create-synthetic-account \
DBTHON_FRONTEND_ORIGIN=https://dbthon-26.onrender.com \
DBTHON_API_BASE_URL=https://4hdf76oz3c2uxe6hmunb2fgm6m0wluin.lambda-url.ap-south-1.on.aws/api/v1 \
node scripts/live_connection_smoke.cjs
```

This explicitly creates one clearly synthetic pending account using an ephemeral
password and fictional NANP example phone. It checks registration, sign-in, mobile
dashboard refresh, production cookie flags, private reads, CSRF rejection and
sign-out. It never resets cloud data or prints credentials. The synthetic account
remains in the database; a duplicate fictional phone or authentication rate limit
can reject a repeated run. It does not approve roles or establish pilot evidence.

## Private fixture administrator onboarding

The IAM-only bootstrap also accepts `configure_fixture_admin` with `email` and
`password_hash`. Generate the hash with the application's Argon2id password policy
in a private operator process; do not pass plaintext passwords to Lambda or commit
them, hashes, event payloads, or authenticated responses. This operation requires
the exact installed synthetic fixture and an already active, verified, approved
Admin account matching its fixture user ID, email and zone. It does not promote
public registrations or change zone membership. It updates the hash, revokes prior
sessions and appends a metadata-only audit event in one transaction. No public
API route or new owner permission is added.
