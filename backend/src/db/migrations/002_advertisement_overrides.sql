CREATE TABLE IF NOT EXISTS advertisement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    placement VARCHAR(30) NOT NULL
        CHECK (placement IN ('home_top', 'home_mid', 'article_top',
                             'article_sidebar', 'category', 'footer')),
    destination_url TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (advertisement_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_ad_overrides_placement
    ON advertisement_overrides(placement, advertisement_id);
