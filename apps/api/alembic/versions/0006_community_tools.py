"""Zone requests, community updates and pickup agreements.

Revision ID: 0006
Revises: 0005
"""

from alembic import op

from app.core.config import ROOT

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0006_community_tools.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError("Community data requires a reviewed forward migration.")
