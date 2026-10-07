"""Original eight entities, scoped access, transaction/ledger foundation.

Revision ID: 0001
Revises: None
"""

from alembic import op

from app.core.config import ROOT

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Execute the complete SQL script without a parameter mapping: PL/pgSQL uses
    # literal percent signs, and psycopg must not parse them as placeholders.
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0001_initial.sql").read_text(), prepare=False)


def downgrade() -> None:
    # Scoped application artifacts only; extensions/cluster roles may serve other DBs.
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            """
      DROP VIEW IF EXISTS public_users,user_trust_summary,zone_impact_summary;
      DROP TABLE IF EXISTS seed_runs,idempotency_keys,sessions,notification_outbox,
        notifications,trust_ledger,ratings,pickups,claims,food_listings,receiver_profiles,
        user_roles,users,zones CASCADE;
      DO $$ DECLARE fn record; BEGIN
        FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc
          WHERE pronamespace='public'::regnamespace AND proname LIKE 'dbthon_%' LOOP
          EXECUTE format('DROP FUNCTION %s CASCADE',fn.signature);
        END LOOP;
      END $$;
        """,
            prepare=False,
        )
