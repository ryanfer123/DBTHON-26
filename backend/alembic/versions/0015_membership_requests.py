"""Membership rejection and administrator applications.

Revision ID: 0015
Revises: 0014
"""

from alembic import op

from app.core.config import ROOT

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0015_membership_requests.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError(
        "Retain request decisions and audit history; use a forward migration."
    )
