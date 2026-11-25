ALTER TABLE images
  ALTER COLUMN binary_data DROP NOT NULL;

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(16) NOT NULL DEFAULT 'pg'
    CHECK (storage_provider IN ('pg', 'r2')),
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

CREATE INDEX IF NOT EXISTS idx_images_storage_provider
  ON images(storage_provider);
