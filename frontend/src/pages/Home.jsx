import { Fragment } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useApi, useDocumentTitle } from '../hooks/useApi';
import ArticleCard, { HeroMini } from '../components/ArticleCard';
import { AdSlot, EmptyState, PageLoading, SectionHead } from '../components/ui';
import { formatDate } from '../lib/format';

function HeroLead({ item }) {
  const { t } = useLocale();
  if (!item) return null;
  return (
    <article className="hero-lead">
      <a className="card-media" href={item.url}>
        {item.image?.optimized || item.image?.thumb ? (
          <img src={item.image.optimized || item.image.thumb} alt="" />
        ) : (
          <span className="thumb-fallback" aria-hidden="true">
            {item.language === 'kn' ? 'ಕ' : 'K'}
          </span>
        )}
      </a>
      <div className="status-line">
        <span className="kicker">{t('topStories')}</span>
        {item.category ? (
          <>
            <span className="sep">/</span>
            <Link to={`/category/${item.category.slug}`}>{item.category.name}</Link>
          </>
        ) : null}
        {item.sponsored ? <span className="sponsored-tag">{item.sponsor_label || t('sponsored')}</span> : null}
      </div>
      <h2>
        <a href={item.url}>{item.headline}</a>
      </h2>
      <p>{item.summary}</p>
      <div className="meta">
        <span>{item.author_name ? `${t('by')} ${item.author_name}` : ''}</span>
        <span className="sep">·</span>
        <span>{formatDate(item.published_at, item.language)}</span>
        <span className="sep">·</span>
        <span>{item.view_count.toLocaleString('en-IN')} {t('views')}</span>
      </div>
    </article>
  );
}

export default function Home() {
  const { lang, t } = useLocale();
  const { districts } = useOutletContext();
  const { data, loading, error } = useApi(`/public/home?lang=${lang}`);
  useDocumentTitle(lang === 'kn' ? 'ತಾಜಾ ಸುದ್ದಿ' : 'Thaja Suddi', { brand: false });

  if (loading && !data) return <PageLoading label={t('latestNews')} />;
  if (error) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState
            title="The newsroom is unreachable"
            body={error.message}
            action={<button type="button" className="btn mt-2" onClick={() => window.location.reload()}>Retry</button>}
          />
        </div>
      </div>
    );
  }

  const featured = data?.featured?.length ? data.featured : data?.latest || [];
  const lead = featured[0];
  const side = (featured.length > 1 ? featured.slice(1, 5) : data?.latest?.slice(1, 5)) || [];
  const homeTopAds = (data?.ads || []).filter((ad) => ad.placement === 'home_top');
  const homeHeroAds = (data?.ads || []).filter((ad) => ad.placement === 'home_hero');
  const homeMidAds = (data?.ads || []).filter((ad) => ad.placement === 'home_mid');
  const homeSidebarAds = (data?.ads || []).filter((ad) => ad.placement === 'home_sidebar');
  const homeAfterLatestAds = (data?.ads || []).filter((ad) => ad.placement === 'home_after_latest');
  const homeBetweenSectionsAds = (data?.ads || []).filter(
    (ad) => ad.placement === 'home_between_sections'
  );
  const homeBottomAds = (data?.ads || []).filter((ad) => ad.placement === 'home_bottom');
  const latest = data?.latest?.slice(0, 9) || [];

  return (
    <div className="page">
      <div className="container">
        <AdSlot ads={homeTopAds} wide />

        {lead ? (
          <div className="hero-grid">
            <HeroLead item={lead} />
            <div className="hero-side">
              {side.map((item) => (
                <HeroMini item={item} key={item.id} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title={t('noArticles')} body={t('noArticlesBody')} />
        )}

        <AdSlot ads={homeHeroAds} wide />

        {districts.length ? (
          <div className="district-strip mt-2" aria-label={t('districts')}>
            {districts.map((district) => (
              <Link className="chip" to={`/district/${district.slug}`} key={district.slug}>
                {district.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="home-grid mt-3">
          <div>
            <SectionHead
              kicker={t('breaking')}
              title={t('latestNews')}
              to="/latest"
            />
            <div className="cards-grid">
              {latest.map((item) => (
                <ArticleCard item={item} key={item.id} />
              ))}
            </div>
            {!latest.length ? <EmptyState title={t('noArticles')} body={t('noArticlesBody')} /> : null}

            <AdSlot ads={homeAfterLatestAds} wide />

            {data?.categorySections?.map((section, index) => (
              <Fragment key={section.category.slug}>
                <section className="category-block">
                  <div className="category-head">
                    <h2>{section.category.name}</h2>
                    <Link className="more" to={`/category/${section.category.slug}`}>
                      {t('viewAll')} →
                    </Link>
                  </div>
                  <div className="category-cards">
                    {section.items.map((item) => (
                      <ArticleCard item={item} key={item.id} showSummary={false} />
                    ))}
                  </div>
                </section>
                {index === 0 ? <AdSlot ads={homeBetweenSectionsAds} wide /> : null}
              </Fragment>
            ))}
          </div>

          <aside className="sidebar">
            <section className="side-panel">
              <h3>{t('trending')}</h3>
              <ol className="trend-list">
                {(data?.trending || []).map((item) => (
                  <li key={item.id}>
                    <a href={item.url}>{item.headline}</a>
                    <div className="meta">
                      <span>{item.category?.name}</span>
                      <span className="sep">·</span>
                      <span>{item.view_count.toLocaleString('en-IN')} {t('views')}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <AdSlot ads={homeMidAds} />
            <AdSlot ads={homeSidebarAds} />

            <section className="side-panel">
              <h3>{t('communityDesk')}</h3>
              <p className="aside-note">{t('communityBody')}</p>
              <a className="btn btn-block" href="mailto:newsroom@thajasuddi.in">{t('submitReport')}</a>
              <Link className="btn btn-outline btn-block mt-1" to="/editorial-policy">
                {t('ourStandards')}
              </Link>
            </section>

            <section className="side-panel">
              <h3>{t('exploreDistricts')}</h3>
              <div className="chips-row">
                {districts.slice(0, 10).map((district) => (
                  <Link className="chip" to={`/district/${district.slug}`} key={district.slug}>
                    {district.name}
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <AdSlot ads={homeBottomAds} wide />
      </div>
    </div>
  );
}
