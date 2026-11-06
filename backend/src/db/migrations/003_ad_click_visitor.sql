ALTER TABLE ad_clicks ADD COLUMN IF NOT EXISTS visitor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_visitor
    ON ad_clicks(advertisement_id, visitor_id);
