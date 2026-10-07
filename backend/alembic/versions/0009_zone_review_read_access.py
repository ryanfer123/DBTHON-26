"""Restricted runtime reads for zone review and global bootstrap member review.

Revision ID: 0009
Revises: 0008
"""

from alembic import op

from app.core.config import ROOT

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            (ROOT / "database/0009_zone_review_read_access.sql").read_text(),
            prepare=False,
        )


def downgrade() -> None:
    raise NotImplementedError("Retain reviewed zone access; use a forward migration.")
