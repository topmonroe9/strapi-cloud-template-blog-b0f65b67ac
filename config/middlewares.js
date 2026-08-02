module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      jsonLimit: '512mb',
      formLimit: '512mb',
      textLimit: '512mb',
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
