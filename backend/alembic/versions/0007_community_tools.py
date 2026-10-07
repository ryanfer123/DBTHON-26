"""Zone requests, community updates and pickup agreements.

Revision ID: 0007
Revises: 0006
"""

from alembic import op

from app.core.config import ROOT

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        # The production database was advanced to 0006 with the community schema
        # before the independent settings revision reached main. Bridge that
        # deployed history by applying the missing settings SQL as 0007. Fresh
        # databases apply settings at 0006 and community tools here.
        probe = "SELECT to_regclass('public.food_requests') IS NOT NULL"
        cursor.execute(probe)
        community_schema_exists = cursor.fetchone()[0]
        sql_path = (
            "database/0007_legacy_settings_bridge.sql"
            if community_schema_exists
            else "database/0007_community_tools.sql"
        )
        cursor.execute((ROOT / sql_path).read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError("Community data requires a reviewed forward migration.")
