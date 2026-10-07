"""Authenticated listing thumbnails and public aggregate impact.

Revision ID: 0005
Revises: 0004
"""

from alembic import op

from app.core.config import ROOT

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0005_listing_photos.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError(
        "Photo removal would delete stored user data; use a reviewed forward migration."
    )
