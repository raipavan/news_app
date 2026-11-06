ALTER TABLE advertisements
    ADD COLUMN IF NOT EXISTS target_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS target_district_id INT REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ads_target_category ON advertisements(target_category_id);
CREATE INDEX IF NOT EXISTS idx_ads_target_district ON advertisements(target_district_id);
