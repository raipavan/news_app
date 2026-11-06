ALTER TABLE advertisements
    ADD COLUMN IF NOT EXISTS display_width INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS max_height INTEGER,
    ADD COLUMN IF NOT EXISTS image_fit VARCHAR(10) NOT NULL DEFAULT 'cover';

ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_display_width_check;
ALTER TABLE advertisements ADD CONSTRAINT advertisements_display_width_check
    CHECK (display_width BETWEEN 25 AND 100);

ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_max_height_check;
ALTER TABLE advertisements ADD CONSTRAINT advertisements_max_height_check
    CHECK (max_height IS NULL OR max_height BETWEEN 40 AND 800);

ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_image_fit_check;
ALTER TABLE advertisements ADD CONSTRAINT advertisements_image_fit_check
    CHECK (image_fit IN ('cover', 'contain'));

ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_placement_check;
ALTER TABLE advertisements ADD CONSTRAINT advertisements_placement_check
    CHECK (placement IN (
        'home_top', 'home_mid', 'home_sidebar', 'home_bottom',
        'article_top', 'article_mid', 'article_bottom', 'article_sidebar',
        'category', 'latest_top', 'district_top', 'search_top', 'footer'
    ));

ALTER TABLE advertisement_overrides DROP CONSTRAINT IF EXISTS advertisement_overrides_placement_check;
ALTER TABLE advertisement_overrides ADD CONSTRAINT advertisement_overrides_placement_check
    CHECK (placement IN (
        'home_top', 'home_mid', 'home_sidebar', 'home_bottom',
        'article_top', 'article_mid', 'article_bottom', 'article_sidebar',
        'category', 'latest_top', 'district_top', 'search_top', 'footer'
    ));
