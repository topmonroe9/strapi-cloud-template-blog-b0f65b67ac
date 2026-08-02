'use strict';

/**
 * TEMPORARY migration API — used once to move data Cloud -> self-host,
 * because Strapi Cloud blocks the transfer websocket (503).
 * Guarded by MIGRATION_KEY. DELETE this whole api after cutover.
 */

const KEY = () => process.env.MIGRATION_KEY || '88179773aa7e2d2b3b36a75bd17a045050d1d8545f840f12';

const authed = (ctx) => {
  const k = ctx.query.key || ctx.request.headers['x-migration-key'];
  return k && k === KEY();
};

const LIMIT = 100000;
const REPORT_POPULATE = {
  content_blocks: {
    populate: {
      images: { populate: { image: true } },
    },
  },
  model: true,
  accounts: true,
};

// strip Strapi-managed ids from a component tree so it can be re-created
const cleanComponent = (block, fileMap) => {
  const out = {};
  for (const [k, v] of Object.entries(block)) {
    if (k === 'id') continue;
    if (k === 'images' && Array.isArray(v)) {
      out.images = v.map((it) => {
        const img = it.image;
        const newId = img ? (fileMap[img.id] ?? img.id) : null;
        const { id, image, ...rest } = it;
        return { ...rest, image: newId };
      });
    } else if (k === 'metrics' && Array.isArray(v)) {
      out.metrics = v.map(({ id, ...rest }) => rest);
    } else {
      out[k] = v;
    }
  }
  return out;
};

module.exports = {
  async stats(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const q = (uid) => strapi.db.query(uid).count();
    ctx.body = {
      reports: await q('api::report.report'),
      models: await q('api::model.model'),
      accounts: await q('api::account.account'),
      versions: await q('api::report-version.report-version'),
      files: await q('plugin::upload.file'),
      editOperations: await q('api::edit-operation.edit-operation'),
    };
  },

  async export(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const only = ctx.query.only ? String(ctx.query.only).split(',') : null;
    const want = (name) => !only || only.includes(name);
    const offset = parseInt(ctx.query.offset || '0', 10);
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : LIMIT;
    let stage = 'init';
    try {
      const out = { exportedAt: new Date().toISOString(), strapiVersion: strapi.config.info?.strapi };
      if (want('reports')) {
        stage = 'reports';
        out.reports = await strapi.db.query('api::report.report').findMany({ populate: REPORT_POPULATE, limit, offset });
      }
      if (want('models')) {
        stage = 'models';
        out.models = await strapi.db.query('api::model.model').findMany({ limit: LIMIT });
      }
      if (want('accounts')) {
        stage = 'accounts';
        out.accounts = await strapi.db.query('api::account.account').findMany({
          populate: { reports: { select: ['documentId', 'uuid'] } }, limit: LIMIT,
        });
      }
      if (want('versions')) {
        stage = 'versions';
        out.versions = await strapi.db.query('api::report-version.report-version').findMany({ limit, offset });
      }
      if (want('files')) {
        stage = 'files';
        out.files = await strapi.db.query('plugin::upload.file').findMany({ limit: LIMIT });
      }
      ctx.body = out;
    } catch (e) {
      strapi.log.error(`[migration.export] failed at ${stage}: ${e.message}`);
      ctx.status = 500;
      ctx.body = { error: e.message, stage, stack: (e.stack || '').split('\n').slice(0, 4) };
    }
  },

  async import(ctx) {
    if (!authed(ctx)) return ctx.unauthorized();
    const body = ctx.request.body || {};
    const { reports = [], models = [], accounts = [], versions = [], files = [] } = body;
    const wipe = ctx.query.wipe === '1';
    const log = { wiped: false, files: 0, models: 0, accounts: 0, reports: 0, versions: 0, errors: [] };

    try {
      if (wipe) {
        for (const uid of [
          'api::report-version.report-version',
          'api::edit-operation.edit-operation',
          'api::edit-session.edit-session',
          'api::report.report',
          'api::account.account',
          'api::model.model',
        ]) {
          await strapi.db.query(uid).deleteMany({ where: {} });
        }
        log.wiped = true;
      }

      // 1) upload files — preserve absolute urls (Cloud CDN)
      const fileMap = {};
      for (const f of files) {
        try {
          const { id, createdBy, updatedBy, folder, related, ...data } = f;
          const created = await strapi.db.query('plugin::upload.file').create({ data });
          fileMap[id] = created.id;
          log.files++;
        } catch (e) { log.errors.push(`file ${f.id}: ${e.message}`); }
      }

      // 2) models (keep password hash + documentId)
      const modelByDoc = {};
      for (const m of models) {
        try {
          const { id, reports: _r, createdBy, updatedBy, ...data } = m;
          const created = await strapi.db.query('api::model.model').create({ data });
          modelByDoc[m.documentId] = created.id;
          log.models++;
        } catch (e) { log.errors.push(`model ${m.name}: ${e.message}`); }
      }

      // 3) accounts (keep password hash + documentId), remember report doc links
      const accountByDoc = {};
      const accountReportLinks = {};
      for (const a of accounts) {
        try {
          const { id, reports: rel, createdBy, updatedBy, ...data } = a;
          const created = await strapi.db.query('api::account.account').create({ data });
          accountByDoc[a.documentId] = created.id;
          accountReportLinks[created.id] = (rel || []).map((r) => r.documentId);
          log.accounts++;
        } catch (e) { log.errors.push(`account ${a.name}: ${e.message}`); }
      }

      // 4) reports — dedupe by documentId (draft+published rows), prefer published.
      //    Use entityService.create (accepts model:id, media image:id inside components).
      const byDoc = new Map();
      for (const r of reports) {
        const ex = byDoc.get(r.documentId);
        if (!ex || (r.publishedAt && !ex.publishedAt)) byDoc.set(r.documentId, r);
      }
      log.docIdPreserved = null;
      for (const r of byDoc.values()) {
        try {
          const {
            id, createdBy, updatedBy, localizations,
            content_blocks, model, accounts: accs, ...scalar
          } = r;
          const blocks = (content_blocks || []).map((b) => cleanComponent(b, fileMap));
          const data = {
            ...scalar, // includes documentId, uuid, dateFrom, dateTo, publishedAt, telegram_notified
            content_blocks: blocks,
            model: model ? modelByDoc[model.documentId] ?? null : null,
            accounts: (accs || []).map((a) => accountByDoc[a.documentId]).filter(Boolean),
          };
          const created = await strapi.entityService.create('api::report.report', { data });
          if (log.docIdPreserved === null) log.docIdPreserved = created.documentId === r.documentId;
          log.reports++;
        } catch (e) { log.errors.push(`report ${r.uuid}: ${e.message}`); }
      }

      // 5) report-versions (raw rows; reference report by document id string)
      for (const v of versions) {
        try {
          const { id, createdBy, updatedBy, ...data } = v;
          await strapi.db.query('api::report-version.report-version').create({ data });
          log.versions++;
        } catch (e) { log.errors.push(`version ${v.id}: ${e.message}`); }
      }

      ctx.body = { ok: true, ...log, errorCount: log.errors.length };
    } catch (e) {
      ctx.body = { ok: false, error: e.message, ...log };
      ctx.status = 500;
    }
  },
};
