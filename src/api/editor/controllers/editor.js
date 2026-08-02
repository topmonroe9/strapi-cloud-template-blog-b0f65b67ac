'use strict';

/**
 * Editor API for the custom report cabinet (reports.apree-tech.com /[uuid]/edit).
 * Key-guarded (EDITOR_KEY) — called server-side from the Next.js app after it has
 * verified the user is an admin/head_pm. Sidesteps the Cloud/self-host user-id skew.
 */

const KEY = () => process.env.EDITOR_KEY || '8700ac1d3b24cdd63a9f8bd1f0c53d9220c93d4a05c55e79';
const authed = (ctx) => {
  const k = ctx.query.key || ctx.request.headers['x-editor-key'];
  return k && k === KEY();
};

const REPORT_POPULATE = {
  content_blocks: { populate: { images: { populate: { image: true } } } },
  model: true,
  accounts: true,
};

module.exports = {
  // GET /api/editor/reports — list for the cabinet index
  async list(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const rows = await strapi.db.query('api::report.report').findMany({
      populate: { model: { select: ['name'] } },
      orderBy: { dateFrom: 'desc' },
      limit: 100000,
    });
    // dedupe by documentId (draft+published), prefer published
    const byDoc = new Map();
    for (const r of rows) {
      const ex = byDoc.get(r.documentId);
      if (!ex || (r.publishedAt && !ex.publishedAt)) byDoc.set(r.documentId, r);
    }
    ctx.body = {
      reports: Array.from(byDoc.values()).map((r) => ({
        documentId: r.documentId,
        uuid: r.uuid,
        title: r.title,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
        published: !!r.publishedAt,
        model: r.model ? { name: r.model.name } : null,
        blocks: Array.isArray(r.content_blocks) ? r.content_blocks.length : undefined,
      })),
    };
  },

  // GET /api/editor/report/:uuid — full report for editing
  async getOne(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const { uuid } = ctx.params;
    // prefer published row, fall back to draft
    const rows = await strapi.db.query('api::report.report').findMany({
      where: { uuid },
      populate: REPORT_POPULATE,
      limit: 10,
    });
    if (!rows.length) return ctx.notFound('Report not found');
    const report = rows.find((r) => r.publishedAt) || rows[0];
    ctx.body = { data: report };
  },

  // PUT /api/editor/report/:uuid — save content_blocks (+ optional meta), snapshot a version
  async save(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const { uuid } = ctx.params;
    const body = ctx.request.body || {};
    const editorName = body.editorName || ctx.request.headers['x-editor-name'] || 'Cabinet';

    const existing = await strapi.db.query('api::report.report').findOne({ where: { uuid } });
    if (!existing) return ctx.notFound('Report not found');
    const documentId = existing.documentId;

    const data = {};
    if (body.content_blocks !== undefined) data.content_blocks = body.content_blocks;
    if (body.title !== undefined) data.title = body.title;
    if (body.dateFrom !== undefined) data.dateFrom = body.dateFrom;
    if (body.dateTo !== undefined) data.dateTo = body.dateTo;

    try {
      // update draft, then publish so the live report reflects the change
      await strapi.documents('api::report.report').update({ documentId, data });
      const published = await strapi.documents('api::report.report').publish({ documentId });

      // snapshot a manual version (best-effort)
      let versionNumber = null;
      try {
        const vs = strapi.service('api::report-version.report-version');
        if (vs && typeof vs.createVersion === 'function') {
          const v = await vs.createVersion(documentId, [], editorName, false);
          versionNumber = v ? v.version_number : null;
        }
      } catch (e) { strapi.log.warn(`[editor] version snapshot failed: ${e.message}`); }

      const fresh = await strapi.db.query('api::report.report').findOne({
        where: { uuid }, populate: REPORT_POPULATE,
      });
      ctx.body = { ok: true, documentId, versionNumber, data: fresh };
    } catch (e) {
      strapi.log.error(`[editor.save] ${uuid}: ${e.message}`);
      ctx.status = 500;
      ctx.body = { ok: false, error: e.message };
    }
  },
};
