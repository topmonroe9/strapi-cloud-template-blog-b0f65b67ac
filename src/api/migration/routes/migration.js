'use strict';
module.exports = {
  routes: [
    { method: 'GET',  path: '/migration/export', handler: 'migration.export', config: { auth: false, policies: [], middlewares: [] } },
    { method: 'POST', path: '/migration/import', handler: 'migration.import', config: { auth: false, policies: [], middlewares: [] } },
    { method: 'GET',  path: '/migration/stats',  handler: 'migration.stats',  config: { auth: false, policies: [], middlewares: [] } },
  ],
};
