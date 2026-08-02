'use strict';
module.exports = {
  routes: [
    { method: 'GET', path: '/editor/reports',        handler: 'editor.list',    config: { auth: false, policies: [], middlewares: [] } },
    { method: 'GET', path: '/editor/report/:uuid',    handler: 'editor.getOne',  config: { auth: false, policies: [], middlewares: [] } },
    { method: 'PUT', path: '/editor/report/:uuid',    handler: 'editor.save',    config: { auth: false, policies: [], middlewares: [] } },
  ],
};
