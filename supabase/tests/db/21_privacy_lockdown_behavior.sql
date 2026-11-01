-- Runs a fixed probe set as each role; prints one line per probe. Asserts with RAISE on failure.
CREATE OR REPLACE FUNCTION pg_temp.probe(role_name text, uid text, label text, q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; res text;
BEGIN
  PERFORM set_config('test.uid', coalesce(uid,''), true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  BEGIN
    EXECUTE format('SELECT count(*) FROM (%s) q WHERE q IS NOT NULL', q) INTO n;
    res := n::text;
  EXCEPTION WHEN insufficient_privilege THEN res := 'DENIED';
  END;
  RESET ROLE;
  RETURN res;
END $$;
