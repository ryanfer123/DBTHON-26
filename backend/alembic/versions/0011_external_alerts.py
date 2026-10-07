"""Opt-in external alert leases, demo budget and provider receipts.

Revision ID: 0011
Revises: 0010
"""

from alembic import op

from app.core.config import ROOT

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            (ROOT / "database/0011_external_alerts.sql").read_text(),
            prepare=False,
        )


def downgrade() -> None:
    raise NotImplementedError(
        "Retain donor declarations, schedules and alert audit; use a forward migration."
    )
