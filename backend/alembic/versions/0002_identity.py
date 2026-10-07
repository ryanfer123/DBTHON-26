"""Identity routines, CSRF-protected writes and private verification history.

Revision ID: 0002
Revises: 0001
"""

from alembic import op

from app.core.config import ROOT

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0002_identity.sql").read_text(), prepare=False)


def downgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            """
          DROP FUNCTION dbthon_claim_listing(bigint);
          ALTER FUNCTION dbthon_claim_listing_impl(bigint) RENAME TO dbthon_claim_listing;
          GRANT EXECUTE ON FUNCTION dbthon_claim_listing(bigint) TO dbthon_runtime;
          DROP FUNCTION dbthon_auth_credentials(text),dbthon_auth_throttle(text,integer,integer),
            dbthon_register(jsonb,text),dbthon_issue_session(bigint,text,text,text,text,text),
            dbthon_revoke_session(),dbthon_update_profile(jsonb),
            dbthon_verify_user(bigint,text[],boolean,text),dbthon_require_actor(boolean);
          DROP TABLE verification_reviews,auth_rate_limits;
          ALTER TABLE sessions DROP COLUMN csrf_hash;
        """,
            prepare=False,
        )
