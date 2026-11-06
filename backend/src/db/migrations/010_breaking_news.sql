ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS articles_breaking_idx ON articles(is_breaking) WHERE is_breaking;
