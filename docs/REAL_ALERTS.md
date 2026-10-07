# Real alert demo setup

Status: adapter and durable external outbox implemented in the feature branch;
no provider account has been configured and no external delivery is claimed.

## Provider and cost boundary

The adapter uses Twilio Programmable Messaging for SMS or WhatsApp. This is an
optional demonstration path, not an assumption that custom application alerts
are permanently free. Twilio's [trial documentation](https://www.twilio.com/docs/usage/trials)
restricts trial content, while the [WhatsApp sandbox guide](https://www.twilio.com/docs/whatsapp/sandbox)
describes limited trial message units and recipients joining a sandbox. Availability
and regional restrictions must be checked against the actual account before setup.
A WhatsApp business-initiated alert needs an [approved template](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).
Our adapter deliberately uses ContentSid instead of assuming an open 24-hour window.
The configured template must accept the alert text as variable `1`; provider review
must approve this actual use case. Stock trial templates are not a substitute for
an approved food-collection alert. If the account cannot approve such a template,
use an eligible SMS sender or defer delivery rather than report a fake receipt.

## Configuration contract (never commit actual values)

| Setting | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Messaging account identifier |
| `TWILIO_AUTH_TOKEN` | Protected worker credential; never put in chat, Git or logs |
| `TWILIO_SMS_FROM` | Approved SMS sender, empty to disable SMS |
| `TWILIO_WHATSAPP_FROM` | Approved `whatsapp:+...` sender, empty to disable WhatsApp |
| `TWILIO_WHATSAPP_CONTENT_SID` | Approved template with variable `1` for notification text |
| `ALERT_DEMO_PHONE` | Exactly one consenting recipient in E.164 format |
| `ALERT_DAILY_LIMIT` | Default 3; maximum 10 send attempts per UTC day, shared across workers |

The account settings API needs the non-secret configuration flags to report
availability. The transport credential belongs to the worker only; API availability
is computed from sender/account/recipient metadata, never by making a provider call.
Use the project's AWS secret skill and runtime-resolution policy before configuring
actual credentials. The mandated `aws-secrets-manager` skill was unavailable in this
session; no secrets were retrieved or configured. No new billable infrastructure
was created for this implementation.

## Delivery and privacy

1. The recipient opts into SMS or WhatsApp in Settings and has the matching saved
   phone number. WhatsApp also requires the recipient to join the sandbox/approved
   sender flow. Registration is not consent to external alerts.
2. Domain changes, notifications and channel outbox rows commit together.
3. Only the existing restricted worker can lease phone/message data. The queue
   selects one allowlisted recipient, current consent, active account, unhidden
   notifications no older than 30 minutes, and configured channels.
4. A database row reserves the daily send budget atomically before each small batch.
   Network calls run after commit. No automatic resend follows an ambiguous timeout,
   avoiding duplicate charges. Expired leases record a redacted failure.
5. A provider SID proves acceptance, not phone delivery. The worker polls recent
   accepted receipts and records delivered/read/failed/undelivered separately.
   `Sent` is the outbox acceptance state; `provider_status` carries device evidence.
   Provider errors, contacts and credentials are never logged.
6. Older/unconfigured queue entries are not replayed as late urgent alerts. Inbox
   updates remain available. Push transport remains unconfigured.

## Activation review

Before releasing: apply migrations 0010/0011 on disposable PostgreSQL, exercise
opt-in/opt-out, receipt state, worker concurrency, single-number and daily-budget
limits, and rerun existing application/browser regressions. Package code and apply
migrations before publishing the frontend. Update AWS configuration only after
reviewing the actual provider account and region requirements. Record one provider
SID, accepted status and observed phone receipt with consenting recipient details
kept out of Git. FR08 remains partial until that evidence exists.
