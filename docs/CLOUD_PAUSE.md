# AWS pause and restart; Render stays hosted

**Current status, 10 October 2026: AWS restored.** RDS is available, API/worker
reserved concurrency is 5/1, bootstrap has no reservation, and the one-minute
worker rule is enabled. Backend readiness and Render both returned HTTP 200.
The pause details below are historical; no new feature code/migrations were deployed.

2026-10-09 (Asia/Kolkata): the user explicitly selected **AWS only**. Render has not
been changed and `https://dbthon-26.onrender.com` returned HTTP 200 after the AWS
pause. Its frontend remains hosted, but AWS-backed application features are
unavailable while the API/database are paused.

## Verified changes

Account `513371322240`, profile `ryan`, region `ap-south-1` verified with STS.
The AWS MCP tools were unavailable, so the authorized AWS CLI fallback was used.
No secret values or Lambda environment variables were read.

| Resource | Before | After |
| --- | --- | --- |
| `DbthonRenderApi-Schedule-51dF6GycfTee` | Enabled, every minute | Disabled |
| `DbthonRenderApi-api` | Reserved concurrency 5 | 0, execution disabled |
| `DbthonRenderApi-worker` | Reserved concurrency 1 | 0, execution disabled |
| `DbthonRenderApi-bootstrap` | No reserved-concurrency setting | 0, execution disabled |
| `dbthonprototype-applicationdatabase701f61e7-nmcwku1xqkn7` | Available | Stopped, independently verified |

Independent describe/get calls verified the schedule/Lambda states and final RDS stopped state. The project
VPC `vpc-0ed5abd59e8b4eac4` has no EC2 instances, NAT gateways or load balancers;
there are no ECS clusters in this region. All three functions have no provisioned
concurrency. RDS is private and deletion protection remains enabled. Its 20 GiB gp3
storage, one-day backup retention and data are preserved. No resources were deleted.

A local receipt with the original settings and independently read pause states is
at `/private/tmp/dbthon-aws-pause-20261009/receipt.json`; it contains no credentials.
This directory is temporary; the restoration values are also retained above.

## Remaining costs and the seven-day limit

Stopping RDS removes instance-hour usage, but storage/backups and retained resources
such as artifacts and configured secret storage can still incur charges. This is
not a zero-cost shutdown of every AWS resource.

RDS automatically restarts after at most seven stopped days. While paused, AWS reported the
automatic restart as **16 October 2026, 7:19 PM IST** (2026-10-16T13:49:30.365Z). No recurring re-stop
infrastructure was created. Lambda executions and the worker rule remain disabled
until manually restored. See [AWS RDS stop/start documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)
and [Lambda concurrency controls](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).

## Restart order

Refresh login if needed, and verify the account before these operations:

```sh
aws sts get-caller-identity --profile ryan --region ap-south-1
aws rds start-db-instance --db-instance-identifier dbthonprototype-applicationdatabase701f61e7-nmcwku1xqkn7 --profile ryan --region ap-south-1
aws rds wait db-instance-available --db-instance-identifier dbthonprototype-applicationdatabase701f61e7-nmcwku1xqkn7 --profile ryan --region ap-south-1
aws lambda delete-function-concurrency --function-name DbthonRenderApi-bootstrap --profile ryan --region ap-south-1
```

Pull main and review/deploy compatible API code and migrations before relying on the
new frontend controls. The current code's single Alembic head is `0015`; this does
not establish the deployed database revision. Browser push still needs signing keys
and its reviewed AWS relay activation. Restore API/worker traffic after readiness:

```sh
aws lambda put-function-concurrency --function-name DbthonRenderApi-api --reserved-concurrent-executions 5 --profile ryan --region ap-south-1
aws lambda put-function-concurrency --function-name DbthonRenderApi-worker --reserved-concurrent-executions 1 --profile ryan --region ap-south-1
aws events enable-rule --name DbthonRenderApi-Schedule-51dF6GycfTee --profile ryan --region ap-south-1
```

If RDS has already automatically restarted, check its state and skip the start
command. Render needs no resume operation. These operations restore the recorded
configuration without creating resources or removing data. Service behavior must
be checked separately when application verification is requested.
