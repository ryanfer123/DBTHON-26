# Temporary cloud pause and restart

Status, 2026-10-09 (Asia/Kolkata): **not paused yet**. The membership-review feature
is pushed to main at `bd56e6a`. AWS CLI profile `ryan` has an expired session; the
previously authorized browser login is awaiting completion. The AWS MCP tools
returned unavailable-tool errors. The Render connector requires explicit selection
of `ryan's workspace` before accessing its services; the confirmation question is
pending. No current cloud resource inventory or stop/suspend result is established.

## Preserve data and a restart receipt

After authentication, verify account `513371322240` and region `ap-south-1` before
mutating anything. Inspect the application stacks and tags to identify DBTHON
resources; do not pause unrelated account resources. Save original concurrency,
worker schedule states, Render auto-deploy/suspension state and DB instance status
in a local receipt that contains no credential or environment-variable values.

Pause the application's worker schedules first. Set only its Lambda functions'
reserved concurrency to zero, preserving their prior values for restoration. Remove
any actual provisioned concurrency after recording it. Inspect project ECS/EC2 or
other active compute before deciding whether it also needs suspension. Stop the
project RDS instance temporarily, preserving deletion protection, storage, backups
and all data. Suspend the confirmed Render service if supported; for a static site,
check the supported suspension/auto-deploy control rather than assuming a running
paid web service. Record actual responses and independently re-read the states.

Do not delete stacks, databases, buckets, snapshots, volumes, secrets or services.
Do not clear credential values or assume setting concurrency to zero deletes code.
Do not claim zero cost: retained storage/backups/artifacts and other retained
resources may still incur charges.

## Limits

RDS stops for at most seven consecutive days, then automatically restarts. Stopped
instances retain data and incur storage/backup charges. A longer pause requires an
explicitly reviewed recurring stop strategy or a separate migration/backup plan;
none has been created. See [AWS RDS stop/start documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html).

Lambda reserved concurrency zero prevents processing new events until restored,
and reserved concurrency itself has no additional charge. Stop upstream schedules
as well, to avoid creating work/retries while the application is paused. See
[AWS Lambda concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).

## Restart order

1. Refresh the named profile and verify account/region.
2. Start the recorded RDS instance and wait until it is available.
3. Pull main and deploy the compatible migrations/API, after deployment review.
   The current code's single Alembic head is `0015`; don't infer the deployed
   revision from the Git branch.
4. Restore the recorded Lambda concurrency values. If a function had no reserved
   concurrency setting, remove the temporary zero reservation rather than guessing
   a new value. Restore provisioned concurrency only if it existed and is needed.
5. Re-enable only schedules that were originally enabled.
6. Resume Render using its original service/auto-deploy settings.
7. Verify the live application separately when the user requests verification.
   Push alerts still require signing keys and reviewed relay activation.

A pause is reversible service configuration, not an infrastructure deletion.
