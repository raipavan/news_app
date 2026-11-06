ALTER TABLE comments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS guest_name VARCHAR(80);

ALTER TABLE article_likes DROP CONSTRAINT IF EXISTS article_likes_pkey;
ALTER TABLE article_likes ADD COLUMN IF NOT EXISTS visitor_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS article_likes_user_idx
    ON article_likes(article_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS article_likes_visitor_idx
    ON article_likes(article_id, visitor_hash) WHERE visitor_hash IS NOT NULL;
