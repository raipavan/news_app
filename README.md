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

## Cloudflare

The Express server ships edge caching headers for Cloudflare and works unchanged behind its proxy. To put Cloudflare in front of the site:

1. Add the domain to Cloudflare and point the DNS record at the server (orange cloud enabled). If a load balancer or nginx sits between Cloudflare and Express, set `TRUST_PROXY` to the number of proxy hops (`1` for Cloudflare only).
2. Set SSL/TLS mode to **Full (strict)** and use a valid origin certificate.
3. Set `PUBLIC_BASE_URL=https://your-domain` and `CORS_ORIGINS=https://your-domain` (plus `https://www.your-domain` if used).
4. Enable Brotli, HTTP/3 and Early Hints in **Speed → Optimization**.

The server emits `CDN-Cache-Control` (Cloudflare-only edge TTL) so browser caching stays conservative:

| Path | Edge TTL |
| --- | --- |
| `/assets/*`, `/api/v1/images/*` | 1 year, immutable |
| `/:lang/news/:slug` (SSR article) | 5 minutes |
| `/api/v1/public/*` | 60 seconds (ticker 15 seconds) |
| `/sitemap.xml`, `/robots.txt` | 10 and 60 minutes |
| `/api/v1/auth/*`, `/api/v1/admin/*`, `/dashboard/*` | bypass |
| `/api/v1/public/ads/*` (click/impression tracking) | bypass |
| SPA shell (`/`, `/latest`, …) | bypass (`no-store` on the index file) |

Cloudflare caches hashed assets and image responses by extension with no extra rules. To also cache SSR pages and public API JSON, open **Caching → Cache Rules → Create rule** and add these rules in order (first match wins):

| # | Rule name | When incoming requests match | Action |
| --- | --- | --- | --- |
| 1 | Bypass private areas | `starts_with(http.request.uri.path, "/api/v1/auth/") or starts_with(http.request.uri.path, "/api/v1/admin/") or starts_with(http.request.uri.path, "/dashboard/")` | Bypass cache |
| 2 | Bypass ad tracking | `starts_with(http.request.uri.path, "/api/v1/public/ads/")` | Bypass cache |
| 3 | Cache article pages | `starts_with(http.request.uri.path, "/en/news/") or starts_with(http.request.uri.path, "/kn/news/")` | Eligible for cache; Edge TTL **Use origin cache control headers** |
| 4 | Cache public API | `starts_with(http.request.uri.path, "/api/v1/public/")` | Eligible for cache; Edge TTL **Use origin cache control headers** |
| 5 | Cache static and images | `starts_with(http.request.uri.path, "/assets/") or starts_with(http.request.uri.path, "/api/v1/images/")` | Eligible for cache; Edge TTL **Use origin cache control headers** |

"Use origin cache control headers" makes Cloudflare read the `CDN-Cache-Control` values above (5 minutes for articles, 60 seconds for public API, 15 seconds for the ticker, 1 year for images). If a catch-all "Cache Everything" rule already exists, place rules 1 and 2 above it.

After a deployment, purge `/` and `/index.html`; hashed files under `/assets/` never need purging. Origin rate limiting and login cookies rely on `TRUST_PROXY` being correct so Cloudflare client IPs are not shared.

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
3. Run `npm run seed` with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (12+ characters). Production seeding creates roles, the bootstrap super admin, districts, categories and taluks only — it does not create demo accounts or content. `SEED_DEMO=true` is a staging-only override.
4. Terminate TLS at the proxy, keep `ALLOW_DEV_RESET_TOKENS` unset, and run `npm run build` without `VITE_SHOW_DEMO_ACCOUNTS`.

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
| `npm run build` | Build the SPA into `frontend/dist` |
| `npm run start` | Start Express (serves API, SSR pages, SPA and static assets) |
| `npm run dev` | Run API and Vite dev server together |
| `npm run deploy` | Full setup and start |
