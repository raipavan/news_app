ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_placement_check;
ALTER TABLE advertisements ADD CONSTRAINT advertisements_placement_check
    CHECK (placement IN (
        'home_top', 'home_mid', 'home_sidebar', 'home_bottom',
        'home_hero', 'home_after_latest', 'home_between_sections',
        'article_top', 'article_mid', 'article_inline_second',
        'article_before_comments', 'article_bottom', 'article_sidebar',
        'article_sidebar_bottom',
        'category', 'category_bottom',
        'latest_top', 'latest_bottom',
        'district_top', 'district_bottom',
        'search_top', 'search_bottom',
        'footer'
    ));

ALTER TABLE advertisement_overrides DROP CONSTRAINT IF EXISTS advertisement_overrides_placement_check;
ALTER TABLE advertisement_overrides ADD CONSTRAINT advertisement_overrides_placement_check
    CHECK (placement IN (
        'home_top', 'home_mid', 'home_sidebar', 'home_bottom',
        'home_hero', 'home_after_latest', 'home_between_sections',
        'article_top', 'article_mid', 'article_inline_second',
        'article_before_comments', 'article_bottom', 'article_sidebar',
        'article_sidebar_bottom',
        'category', 'category_bottom',
        'latest_top', 'latest_bottom',
        'district_top', 'district_bottom',
        'search_top', 'search_bottom',
        'footer'
    ));
