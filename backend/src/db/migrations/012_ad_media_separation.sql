ALTER TABLE images
  ADD COLUMN IF NOT EXISTS is_ad_protected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_images_ad_protected
  ON images(is_ad_protected);

UPDATE images
   SET is_ad_protected = TRUE
 WHERE id IN (
   SELECT image_id FROM advertisements WHERE image_id IS NOT NULL
   UNION
   SELECT ai.image_id
     FROM article_images ai
     JOIN articles a ON a.id = ai.article_id
    WHERE a.is_sponsored = TRUE
 )
    OR parent_id IN (
   SELECT image_id FROM advertisements WHERE image_id IS NOT NULL
   UNION
   SELECT ai.image_id
     FROM article_images ai
     JOIN articles a ON a.id = ai.article_id
    WHERE a.is_sponsored = TRUE
 );
