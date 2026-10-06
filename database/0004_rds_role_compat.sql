-- RDS does not expose PostgreSQL superuser; keep the sealed function owner
-- non-login and grant its SECURITY DEFINER routines explicit RLS policy access.
DO $$ BEGIN
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname='dbthon_guard') THEN
    ALTER ROLE dbthon_guard NOLOGIN NOBYPASSRLS;
  ELSE
    ALTER ROLE dbthon_guard NOLOGIN;
  END IF;
END $$;

CREATE POLICY guard_scope ON zones TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON users TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON user_roles TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON receiver_profiles TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON food_listings TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON claims TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON pickups TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON ratings TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON trust_ledger TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON notifications TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON notification_outbox TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON sessions TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON idempotency_keys TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON seed_runs TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON auth_rate_limits TO dbthon_guard USING (true) WITH CHECK (true);
CREATE POLICY guard_scope ON verification_reviews TO dbthon_guard USING (true) WITH CHECK (true);

-- Ownership changes need CREATE during bootstrap only; no runtime DDL is allowed.
REVOKE CREATE ON SCHEMA public FROM dbthon_guard;
