CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'blocked')),
    can_publish BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL UNIQUE,
    name_kn VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS taluks (
    id SERIAL PRIMARY KEY,
    district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL,
    name_kn VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en VARCHAR(100) NOT NULL,
    name_kn VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id),
    category_id UUID REFERENCES categories(id),
    district_id INT REFERENCES districts(id),
    taluk_id INT REFERENCES taluks(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'in_review',
                          'approved', 'published', 'rejected', 'archived')),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
    sponsor_label VARCHAR(150),
    view_count BIGINT NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    language VARCHAR(5) NOT NULL CHECK (language IN ('kn', 'en')),
    headline VARCHAR(300) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    slug VARCHAR(350) NOT NULL UNIQUE,
    source TEXT,
    caption TEXT,
    seo_title VARCHAR(300),
    seo_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'in_review',
                          'approved', 'published', 'rejected')),
    submitted_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    reviewer_id UUID REFERENCES users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (article_id, language)
);

CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binary_data BYTEA NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT NOT NULL,
    width INT,
    height INT,
    variant VARCHAR(20) NOT NULL DEFAULT 'original'
        CHECK (variant IN ('original', 'optimized', 'thumb')),
    parent_id UUID REFERENCES images(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_images (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    image_type VARCHAR(30) NOT NULL DEFAULT 'gallery'
        CHECK (image_type IN ('main', 'gallery')),
    position INT NOT NULL DEFAULT 0,
    caption TEXT,
    PRIMARY KEY (article_id, image_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_article_main_image
    ON article_images(article_id) WHERE image_type = 'main';

CREATE TABLE IF NOT EXISTS article_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    translation_id UUID REFERENCES article_translations(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id),
    decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('approved', 'rejected', 'published', 'correction')),
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    translation_id UUID REFERENCES article_translations(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    editor_id UUID REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS article_tags (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_likes (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (article_id, user_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (article_id, user_id)
);

CREATE TABLE IF NOT EXISTS article_views (
    id BIGSERIAL PRIMARY KEY,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    visitor_hash TEXT,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_shares (
    id BIGSERIAL PRIMARY KEY,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL,
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'dismissed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    advertiser_name VARCHAR(200),
    image_id UUID REFERENCES images(id) ON DELETE SET NULL,
    destination_url TEXT NOT NULL,
    placement VARCHAR(30) NOT NULL
        CHECK (placement IN ('home_top', 'home_mid', 'article_top',
                             'article_sidebar', 'category', 'footer')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'expired')),
    is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
    id BIGSERIAL PRIMARY KEY,
    advertisement_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    visitor_hash TEXT,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_clicks (
    id BIGSERIAL PRIMARY KEY,
    advertisement_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(50),
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_articles_status_date ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_district ON articles(district_id);
CREATE INDEX IF NOT EXISTS idx_translations_article ON article_translations(article_id);
CREATE INDEX IF NOT EXISTS idx_translations_status_lang ON article_translations(status, language, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_headline_trgm ON article_translations USING gin (headline gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_translations_content_trgm ON article_translations USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_views_article_date ON article_views(article_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_article_status ON comments(article_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_images_article ON article_images(article_id);
CREATE INDEX IF NOT EXISTS idx_images_parent ON images(parent_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON article_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_placement_status ON advertisements(placement, status);
