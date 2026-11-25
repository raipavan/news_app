# Thaja Suddi (ತಾಜಾ ಸುದ್ದಿ)

A bilingual (Kannada / English) news platform for Karnataka: a public news site with server-rendered article pages, a full editorial workflow with independently reviewed language versions, community submissions, and an admin console.

## Stack

- **Backend:** Node.js, Express 4, PostgreSQL 16, `pg`, JWT access/refresh rotation, bcrypt, `sharp` image processing
- **Frontend:** React 18, Vite 6, React Router 6, custom i18n (EN/KN)
- **Article pages:** server-rendered by Express with OG/Twitter metadata, hreflang, JSON-LD, canonical URLs
- **Database:** Docker Compose PostgreSQL, exposed on host port **5434**
- **UI:** warm editorial design system in `shared/site.css` (Noto Serif headlines, Inter UI, Noto Sans Kannada)

## Quick start

Requirements: Node.js 20+, Docker Desktop.

```bash
npm install
cp backend/.env.example backend/.env   # adjust secrets for production
npm run db:up                          # start PostgreSQL on localhost:5434
npm run migrate
npm run seed
npm run build
npm run start                          # http://localhost:4000
```

For development with hot reload:

```bash
npm run dev   # API on :4000, Vite on :5173 (proxies API and SSR pages)
```

`npm run deploy` runs database, migration, seed, build and server start in sequence.

### Environment

`backend/.env`:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://news:news@localhost:5434/karnataka_news
ACCESS_TOKEN_SECRET=change-me
REFRESH_TOKEN_SECRET=change-me-too
ACCESS_TOKEN_TTL=30m
REFRESH_TOKEN_TTL_DAYS=14
PUBLIC_BASE_URL=            # e.g. https://news.example.com in production
UPLOAD_MAX_BYTES=8388608
```

`PUBLIC_BASE_URL` is used for canonical URLs, sitemap entries, and share links.

## Cloudflare (Free Plan + Low-Load VPS Offload)

The application is designed to run on a lightweight VPS with **zero Redis on the VPS** and **zero image binary storage or serving load on PostgreSQL/Express**:

- **Images → Cloudflare R2 + Custom Domain:** Uploads are validated and converted to WebP once on upload, then stored in Cloudflare R2 and served directly from `https://media.tajasuddinews.in` with immutable 1-year edge caching and \$0 egress. Advertisement creatives and sponsored post images (`is_ad_protected = TRUE`) are kept separate from regular news images so Super Admin monthly storage flushes never touch paid ads, while deleting an ad or sponsored post in the app deletes its assets from both PostgreSQL and Cloudflare R2.
- **Read Caching → Cloudflare Edge Cache + Auto-Purge API:** Public feeds, SSR articles, approved comments, categories, and districts cache at the Cloudflare edge and automatically purge when editors publish, update, archive, moderate comments, or change ads/taxonomy.
- **High-Frequency Analytics → Scoped Edge Worker + SQLite Durable Object (`cloudflare-edge/`):** Only `POST /api/v1/articles/:id/view` and `POST /api/v1/public/ads/:id/impression` run through the Worker, deduplicating 30-minute views in edge SQLite and flushing batched deltas to the VPS every 60 seconds.

### 1. Cloudflare R2 bucket & custom media domain

1. In Cloudflare Dashboard → **R2 Object Storage**, create a bucket (e.g., `tajasuddinews-media`).
2. In the bucket **Settings → Public Access → Custom Domains**, connect `media.tajasuddinews.in` (same Cloudflare zone).
3. Create an **R2 API Token** scoped to **Object Read & Write** for that bucket only, and note your **Account ID**, **Access Key ID**, and **Secret Access Key**.
4. Set in `backend/.env`:
   ```env
   IMAGE_STORAGE=r2
   R2_ACCOUNT_ID=<account-id>
   R2_ACCESS_KEY_ID=<access-key>
   R2_SECRET_ACCESS_KEY=<secret-key>
   R2_BUCKET_NAME=tajasuddinews-media
   R2_PUBLIC_BASE_URL=https://media.tajasuddinews.in
   ```
   Build the frontend with `VITE_MEDIA_BASE_URL=https://media.tajasuddinews.in` so uploader previews and rich editor inserts use the media subdomain directly.
5. If you already have images stored in PostgreSQL `BYTEA`, backfill them to R2 and reclaim DB disk space:
   ```bash
   npm run migrate
   npm run images:migrate-r2 -- --rewrite-html
   # Then inside PostgreSQL: VACUUM FULL images;
   ```

### 2. Cloudflare Cache Rules & Tiered Cache (Free Plan)

1. Turn on **Caching → Tiered Cache → Smart Tiered Caching** (included on the Free plan) and enable **Brotli**, **HTTP/3**, and **Early Hints** under **Speed → Optimization**.
2. Set SSL/TLS mode to **Full (strict)**.
3. In **Caching → Cache Rules → Create rule**, add these rules in order (first match wins):

| # | Rule name | When incoming requests match | Action |
| --- | --- | --- | --- |
| 1 | Cache R2 media domain | `http.host eq "media.tajasuddinews.in"` | Eligible for cache; Edge TTL **1 year** |
| 2 | Bypass private areas | `starts_with(http.request.uri.path, "/api/v1/auth/") or starts_with(http.request.uri.path, "/api/v1/admin/") or starts_with(http.request.uri.path, "/api/v1/internal/") or starts_with(http.request.uri.path, "/dashboard")` | Bypass cache |
| 3 | Bypass ad click & impression tracking | `starts_with(http.request.uri.path, "/api/v1/public/ads/")` | Bypass cache |
| 4 | Cache article pages | `starts_with(http.request.uri.path, "/en/news/") or starts_with(http.request.uri.path, "/kn/news/")` | Eligible for cache; Edge TTL **Use origin cache control headers** |
| 5 | Cache public API & approved comments | `starts_with(http.request.uri.path, "/api/v1/public/") or (http.request.uri.path contains "/comments" and http.request.method eq "GET")` | Eligible for cache; Edge TTL **Use origin cache control headers** |
| 6 | Cache static and legacy image redirects | `starts_with(http.request.uri.path, "/assets/") or starts_with(http.request.uri.path, "/static/") or starts_with(http.request.uri.path, "/api/v1/images/")` | Eligible for cache; Edge TTL **Use origin cache control headers** |

Origin `CDN-Cache-Control` headers emitted by [cdnCache.js](file:///d:/New_app/backend/src/middleware/cdnCache.js):

| Path | Edge TTL (`CDN-Cache-Control`) |
| --- | --- |
| `/assets/*`, `/api/v1/images/*` | 1 year, immutable |
| `/api/v1/public/categories`, `/districts`, `/taluks` | 1 hour (`stale-while-revalidate=3600`, `stale-if-error=86400`) |
| `/:lang/news/:slug` (SSR article) | 10 minutes (`stale-while-revalidate=1800`, `stale-if-error=86400`) |
| `/api/v1/public/*` (home, latest, trending, search, ads) | 5 minutes (`stale-while-revalidate=600`, `stale-if-error=86400`) |
| `GET /api/v1/articles/:id/comments` | 60 seconds (`stale-while-revalidate=120`, `stale-if-error=3600`) |
| `/api/v1/public/ticker` | 30 seconds (`stale-while-revalidate=60`, `stale-if-error=3600`) |
| `/sitemap.xml`, `/robots.txt` | 30 and 60 minutes |
| `/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/internal/*`, `/dashboard/*`, `/api/v1/public/ads/*` | bypass (`no-store`) |

### 3. Cloudflare WAF Rate Limiting Rules (Free Plan)

In **Security → WAF → Rate limiting rules**, add an edge rule before traffic reaches your VPS (Cloudflare Free supports IP-based 10s rate limits):
- **Auth & comments protection:** `(starts_with(http.request.uri.path, "/api/v1/auth/") or (http.request.uri.path contains "/comments" and http.request.method eq "POST"))` → Block for 10s when requests exceed 15 per 10 seconds per IP.

### 4. Automatic Cache Purge API token

1. In Cloudflare Dashboard → **My Profile → API Tokens → Create Custom Token**, grant **Zone → Cache Purge → Purge** on your domain zone.
2. Set in `backend/.env`:
   ```env
   PUBLIC_BASE_URL=https://tajasuddinews.in
   CORS_ORIGINS=https://tajasuddinews.in,https://www.tajasuddinews.in
   CF_ZONE_ID=<your-zone-id>
   CF_API_TOKEN=<cache-purge-token>
   CF_CACHE_PURGE_MODE=urls
   ```

### 5. Deploy the Scoped Edge Worker (`cloudflare-edge/`)

Mount the Worker **only** on the two high-frequency write routes so all public `GET` reads stay on unlimited free CDN cache:

```bash
# Generate a random flush secret and set it in both backend/.env (INTERNAL_FLUSH_SECRET) and Worker secrets
cd cloudflare-edge
# Uncomment routes in cloudflare.config.ts for tajasuddinews.in
npx cf deploy
npx wrangler secret put INTERNAL_FLUSH_SECRET --name thaja-suddi-edge
```

### 6. Run Isolated on VPS with Cloudflare Tunnel (`docker-compose.prod.yml`)

Use `-p tajasuddinews` so the database (`tajasuddinews_db`), app (`tajasuddinews_app`), tunnel (`tajasuddinews_tunnel`), bridge network (`tajasuddinews_net`), and volume (`tajasuddinews_pgdata`) stay isolated from all other containers on the VPS with zero host ports opened.

In **Zero Trust → Networks → Tunnels**, create a tunnel with public hostname `tajasuddinews.in` (and `www.tajasuddinews.in` if used) pointing to service `http://tajasuddinews_app:4000`, set `CLOUDFLARE_TUNNEL_TOKEN` and `POSTGRES_PASSWORD`, and set `DATABASE_URL=postgres://news:<POSTGRES_PASSWORD>@db:5432/karnataka_news` in `backend/.env`:

```bash
docker compose -p tajasuddinews -f docker-compose.prod.yml up -d --build
docker compose -p tajasuddinews -f docker-compose.prod.yml exec app npm --workspace backend run migrate
docker compose -p tajasuddinews -f docker-compose.prod.yml exec app npm --workspace backend run seed
```

### 7. Super Admin Monthly Cloudflare Storage Flush

Super Admins can manage storage directly under **Dashboard → Admin overview → Cloudflare Storage & Monthly Flush**:
- **Regular News Media vs. Protected Ads:** Only regular news images (`is_ad_protected = FALSE`) are eligible for monthly flushing; article text and SEO URLs remain intact while deleted inline `<img>` tags are cleaned from old news articles. Banner advertisements (`advertisements.image_id`) and sponsored posts (`articles.is_sponsored = TRUE`) are always protected.
- **Auto-Flush Monthly Toggle:** Runs a daily check in the background and automatically flushes regular news images older than the configured retention period (default 30 days) once per cycle.
- **App-Driven Ad Deletion:** Deleting or replacing an advertisement image or permanently deleting a sponsored post from the dashboard immediately deletes the image from both PostgreSQL and Cloudflare R2.

Origin rate limiting and login cookies rely on `TRUST_PROXY=1` so Cloudflare `X-Forwarded-For` client IPs are preserved. After each release, purge `/` and `/index.html`; hashed files under `/assets/` never need purging.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@thajasuddi.in` | `Admin@12345` |
| Editor | `editor@thajasuddi.in` | `Editor@12345` |
| Reporter | `reporter@thajasuddi.in` | `Reporter@12345` |
| Community Contributor | `contributor@thajasuddi.in` | `Contributor@12345` |
| Reader | `reader@thajasuddi.in` | `Reader@12345` |

The sign-in page shows the reader demo account in development builds, or when `VITE_SHOW_DEMO_ACCOUNTS=true` is set at build time. It is hidden in production builds.

Public registration always creates a **Reader** account. Newsroom logins (Editor, Reporter, Contributor) are created only by a Super Admin from **Dashboard → Users & roles**.

## Main routes

| URL | Description |
| --- | --- |
| `/` | Homepage: hero, latest, sections, districts, trending, ads |
| `/latest` | All published stories with filters |
| `/category/:slug` | Section pages |
| `/district/:slug` | District pages with taluk filter |
| `/search?q=` | Bilingual search |
| `/:lang/news/:slug` | Server-rendered article page (`en` / `kn`) |
| `/login`, `/register`, `/forgot-password` | Authentication |
| `/about`, `/editorial-policy`, `/corrections`, `/privacy-policy`, `/terms` | Policy pages |
| `/dashboard` | Newsroom overview (role-aware) |
| `/dashboard/articles` | Writer's article list |
| `/dashboard/articles/new` | Article editor; `?lang=` selects language |
| `/dashboard/review` | Editorial review queue |
| `/dashboard/admin/*` | Admin dashboard, users, taxonomy, ads, moderation, analytics, audit |
| `/sitemap.xml`, `/robots.txt` | SEO endpoints |

## Bilingual workflow

Each language version has its own status, slug, SEO fields and review history. A story can exist in Kannada only, English only, or both linked translations. Approving or publishing one language never publishes the other; the article URL for each published version is `/<lang>/news/<slug>` with `hreflang` alternates and an `x-default` pointer to English when available.

Workflow: `draft → submitted → in_review → approved → published` with `rejected` and resubmission. Corrections are stored as revisions and can be applied to the live version. Every editorial action is written to the audit log.

## Images

Images are stored in PostgreSQL (`BYTEA`) with MIME type, filename, size and dimensions. Uploads are validated by magic bytes and decoded with `sharp`; an optimized WebP (max 1600px) and a 480×360 thumbnail are generated. The image API streams variants with ETag and immutable caching:

```
GET /api/v1/images/:id?variant=original|optimized|thumb
```

Limits: 8 MB per file, minimum 200×150 px.

## Security

- bcrypt password hashing, short-lived access tokens, rotating HttpOnly refresh cookies
- Role-based access control (Super Admin, Editor, Reporter, Contributor, Reader) and granular permissions
- Parameterized SQL, HTML sanitization, magic-byte image validation, rate limiting
- Upload and request size limits, security headers via Helmet

Before production:

1. Set `NODE_ENV=production`. Startup fails unless `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` (32+ random characters each), `DATABASE_URL`, and an HTTPS `PUBLIC_BASE_URL` are set.
2. Set `CORS_ORIGINS` to the exact public origin(s) and `TRUST_PROXY` to the number of reverse-proxy hops (or `false`).
3. Run `npm run seed` with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (12+ characters). Production seeding creates roles, the bootstrap super admin, districts, categories and taluks only — it does not create demo accounts or content. If the two admin variables are missing, seeding still completes but skips the super admin and logs a warning. `SEED_DEMO=true` is a staging-only override.
4. Terminate TLS at the proxy, keep `ALLOW_DEV_RESET_TOKENS` unset, and run `npm run build` without `VITE_SHOW_DEMO_ACCOUNTS`.

If you need to add or repair a Super Admin after deployment, run the CLI against the database that `DATABASE_URL` points to:

```bash
npm run admin:create -- editor@example.com 'a-passphrase-of-12-plus-chars' 'Display Name'
```

It creates the account (or resets the password of an existing one), sets `status = 'active'` and binds the `super_admin` role. The password is bcrypt-hashed in memory and never stored in the repo, so pick a value you will keep.

## Project layout

```
backend/
  src/config        environment configuration
  src/db            schema/migrations and seed data
  src/controllers   auth, articles, public, engagement, admin, images, SSR
  src/services      article, image, SEO/SSR rendering
  src/routes        API route definitions
frontend/
  src/pages         public pages, writer dashboard, admin console
  src/components    layout, cards, editor, uploaders, UI primitives
  src/context       auth, locale, toast
  src/lib           API client, i18n, formatting
shared/site.css     shared design system
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL |
| `npm run migrate` | Apply schema |
| `npm run seed` | Seed taxonomy; development/staging also adds demo content and accounts |
| `npm run admin:create -- <email> <password> [name]` | Create or reset a Super Admin against `DATABASE_URL` |
| `npm run build` | Build the SPA into `frontend/dist` |
| `npm run start` | Start Express (serves API, SSR pages, SPA and static assets) |
| `npm run dev` | Run API and Vite dev server together |
| `npm run deploy` | Full setup and start |
