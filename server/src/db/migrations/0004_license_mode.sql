-- 0004: distinguish online (dashboard) vs offline (manual key) licenses.
-- The license table from 0003 already carries token/plan/access_until/grace_days/
-- token_expires_at/last_seen_at/last_status; offline manual keys reuse those columns
-- and only need a mode marker.
ALTER TABLE license ADD COLUMN mode TEXT;
