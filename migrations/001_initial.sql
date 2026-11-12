-- PostgreSQL production schema. The idempotent application bootstrap applies the same schema.
-- Provision DATABASE_URL in the authorised TGIQ Vercel project before deployment.
CREATE TABLE IF NOT EXISTS tgiq_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, document TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS program (id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, graphic TEXT, frozen INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, output_token_hash TEXT);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, filename TEXT NOT NULL, bytes_base64 TEXT, url TEXT, origin TEXT NOT NULL, attribution TEXT NOT NULL, rights TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS provider_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts (identity TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, window_start TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS episodes_updated ON episodes(updated_at);
CREATE INDEX IF NOT EXISTS provider_expiry ON provider_cache(expires_at);
INSERT INTO program(id,version,graphic,frozen,updated_at) VALUES('main',0,NULL,1,CURRENT_TIMESTAMP::text) ON CONFLICT(id) DO NOTHING;
INSERT INTO tgiq_migrations(version,applied_at) VALUES(1,CURRENT_TIMESTAMP::text) ON CONFLICT(version) DO NOTHING;
