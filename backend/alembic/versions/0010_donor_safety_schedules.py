"""Donor declarations and daily donation reminders.

Revision ID: 0010
Revises: 0009
"""

from alembic import op

from app.core.config import ROOT

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            (ROOT / "database/0010_donor_safety_schedules.sql").read_text(),
            prepare=False,
        )


def downgrade() -> None:
    raise NotImplementedError(
        "Retain donor declarations, schedules and alert audit; use a forward migration."
    )
