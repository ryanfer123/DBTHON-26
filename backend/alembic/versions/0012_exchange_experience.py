"""Private exchange coordination, saved listings and issue review.

Revision ID: 0012
Revises: 0011
"""

from alembic import op

from app.core.config import ROOT

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            (ROOT / "database/0012_exchange_experience.sql").read_text(),
            prepare=False,
        )


def downgrade() -> None:
    raise NotImplementedError(
        "Retain exchange messages, reports and audit records; use a forward migration."
    )
