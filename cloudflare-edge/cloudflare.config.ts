import { bindings, defineConfig, exports } from 'cf/config';
import * as entrypoint from './src/index.js' with { type: 'cf-worker' };

export default defineConfig({
  worker: {
    name: 'thaja-suddi-edge',
    entrypoint,
    compatibilityDate: '2026-11-01',
    exports: {
      AnalyticsBufferDO: exports.durableObject({
        storage: 'sqlite',
      }),
    },
    env: {
      ORIGIN_BASE_URL: 'https://tajanewssuddi.in',
      SHARD_COUNT: '4',
      FLUSH_INTERVAL_MS: '60000',
      INTERNAL_FLUSH_SECRET: bindings.secret(),
      ANALYTICS_BUFFER: bindings.durableObject({
        className: 'AnalyticsBufferDO',
      }),
    },
    // Mount ONLY on high-frequency write routes so public GET reads stay on unlimited free CDN cache:
    // routes: [
    //   { pattern: 'tajanewssuddi.in/api/v1/articles/*/view', zone_name: 'tajanewssuddi.in' },
    //   { pattern: 'tajanewssuddi.in/api/v1/public/ads/*/impression', zone_name: 'tajanewssuddi.in' },
    // ],
  },
});
