import pytest
from sqlalchemy import text

pytestmark = pytest.mark.database


def test_every_public_definer_is_pinned_and_not_publicly_executable(db_engine):
    with db_engine.connect() as connection:
        routines = (
            connection.execute(
                text("""
          SELECT p.oid::regprocedure::text AS routine,p.proconfig,
            EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
              WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.prosecdef AND p.proname LIKE 'dbthon_%'
        """)
            )
            .mappings()
            .all()
        )
    assert len(routines) >= 20
    for routine in routines:
        assert "search_path=pg_catalog, public, pg_temp" in (routine["proconfig"] or []), routine[
            "routine"
        ]
        assert not routine["public_execute"], routine["routine"]
