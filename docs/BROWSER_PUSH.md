# Browser push notifications

Implementation: branch `feat/browser-push`, migration `0013`. Deployment and real
browser receipt remain release gates. Settings exposes availability honestly; the
feature defaults to disabled until the signing key and delivery service are ready.

## User flow

Settings → Browser notifications → Enable browser alerts → browser Allow prompt.
Permission is requested only from this button. HTTPS and a browser with Push API
support are required. On iPhone/iPad, install the app on the Home Screen and launch
it there ([WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

Users enable each browser independently, can disconnect it in Settings, and signing
out disconnects it before the session is revoked. The browser capability is never
silently reassigned between accounts. Enable rotates an existing local subscription.
Expired browser subscriptions may occupy an account slot until a provider reports
404/410; five browsers per account are allowed.

New notifications, including the existing eligible nearby-food alerts, claim/pickup
updates, participant messages and daily donor reminders, enqueue one push delivery
per opted-in browser in the same database transaction. No historical inbox backfill.
The lock-screen preview is always generic: no food addresses, names, phone numbers,
private message bodies or contact details. Clicking opens `/inbox` and normal session
and role checks still apply. Device permissions and operating-system settings control
whether an accepted alert is displayed. Provider acceptance is not receipt evidence.

## Database and transport

`browser_push_subscriptions` stores owner, endpoint and browser encryption keys.
These are private capabilities. Runtime roles have no table access; guarded routines
support own registration, status and revocation. Only the restricted worker can lease
send targets. `browser_push_deliveries` has a unique notification/subscription pair,
SKIP LOCKED leasing, two-minute leases, and Pending/Processing/Accepted/Failed states.
Deleting a subscription deletes its transport records, preserving the inbox and
existing domain/trust audit records. Preference changes and browser enable/disable
append private audit events without endpoints or encryption keys.

At most five sends are leased per sweep. Alerts older than 30 minutes and cleared
inbox events are discarded. Consent and account activity are checked when leasing.
A send already in flight can arrive after opt-out. Unknown outcomes/timeouts are not
retried automatically; inbox delivery remains independent. Provider 404/410 removes
the stale subscription. Disable all-account push through the preferences API discards
pending sends so re-enable cannot replay them.

The [official pywebpush library](https://github.com/web-push-libs/pywebpush) encrypts
payloads and signs VAPID claims. Each network request has a five-second timeout,
redirects disabled, a five-minute TTL, and an allowlist for Google FCM, Mozilla,
Apple, and Microsoft notify.windows.com hosts. No arbitrary user endpoints, provider
exception text or subscription payloads enter logs.

## AWS activation review

Read-only AWS inspection confirmed a local-only database-VPC route and no NAT
gateways. `deploy/aws-lambda/push-relay.template.json` adds one scheduled 256 MB Lambda outside
the database VPC. It has no database login and no public function URL. Its IAM role
can invoke only the existing worker and write its own logs (seven-day retention).
The existing private worker leases/finalizes delivery through IAM-only invocation;
the relay sends to browser providers over the internet. No NAT gateway, new database,
SMS provider, queue, Step Functions workflow or paid always-running server is added.

The relay schedule starts disabled. `PushEnabled` defaults false on both templates.
The approved deploy needs an existing VAPID secret JSON field `private_key`; the
relay template references it through Secrets Manager dynamic reference. Only the
public application key goes into API/worker config and authenticated browser config.
Do not commit keys or retrieve secret values into chat/logs. The repository requires
the `aws-secrets-manager` skill and `asm-exec` before any signing-key operation; that
exact skill was unavailable during this implementation, so no keys were generated
and no AWS mutation was performed.

Cost review: one minute cadence is 43,200 relay invocations per 30-day month, plus
43,200 lease calls and at most five finish calls per sweep (at maximum continuous
traffic, total 302,400 invocations). Empty sweeps are brief; execution duration,
CloudWatch logs, data transfer and secret storage also count. The published
[Lambda allowance](https://aws.amazon.com/lambda/pricing/) is one million requests
and 400,000 GB-seconds monthly, shared with existing workloads. Existing account
eligibility and remaining credits/allowances have not been checked. Zero cost is
not promised. Reuse an approved existing secret instead of adding secret storage.

Deployment order after review:

1. Package the locked dependencies and deploy the operator with revisions 0013 and 0014 allowed.
2. Run operator migration; confirm the resulting revision is 0014.
3. Update API/worker code with PushEnabled=false; confirm normal readiness.
4. Configure the VAPID key through the required secret workflow, deploy the relay
   disabled, review IAM/change sets and current account cost allowances.
5. Enable relay/API/worker flags with the matching public key; never put the private
   key on the API, database worker, frontend or in Git.
6. Opt in one consenting browser, trigger a real permitted inbox update, close the
   tab and record actual device receipt/click navigation. Repeat revocation and
   account-switch checks before declaring full FR08. No simulated delivery claim.

For a local/non-VPC worker with internet access, configure PUSH_DELIVERY_ENABLED,
PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY and PUSH_SUBJECT securely; the normal worker can
send directly. AWS uses the relay and leaves PUSH_PRIVATE_KEY unset on its private
worker, so only one transport consumes each leased delivery.

Merged migration order: `0012 -> 0013 -> 0014`. Account deletion removes push subscriptions and their delivery rows. Real push delivery still requires the reviewed AWS/key activation steps above.
