import { DurableObject } from 'cloudflare:workers';
import { AnalyticsBufferCore, handleAnalyticsRequest } from './analyticsBuffer.js';

export class AnalyticsBufferDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new AnalyticsBufferCore(ctx, env);
  }

  async recordView(articleId, visitorHash, nowMs) {
    return this.core.recordView(articleId, visitorHash, nowMs);
  }

  async recordImpression(adId, visitorHash, nowMs) {
    return this.core.recordImpression(adId, visitorHash, nowMs);
  }

  async alarm() {
    return this.core.alarm();
  }
}

export default {
  async fetch(request, env) {
    return handleAnalyticsRequest(request, env);
  },
};
