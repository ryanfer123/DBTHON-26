"""Guarded redistribution commands and leased in-app notifications.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

from app.core.config import ROOT

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0003_workflows.sql").read_text(), prepare=False)


def downgrade() -> None:
    op.execute("""
      DROP POLICY claim_task_scope ON claims;
      DROP FUNCTION dbthon_can_view_task(bigint);
      DROP FUNCTION dbthon_command(text,bigint,bigint,jsonb,text),dbthon_due_listings(integer),
        dbthon_expire_one(bigint),
        dbthon_lease_notifications(integer),dbthon_finish_notification(bigint,uuid,boolean),dbthon_trust(bigint);
      DROP INDEX ix_listings_expiry,ix_pickups_scheduled,ix_idempotency_expiry,
        ix_listings_zone_created,ix_claims_claimed;
      ALTER TABLE notification_outbox DROP COLUMN lease_token;
      ALTER TABLE pickups DROP COLUMN accepted_at;
    """)
