'use strict';

/**
 * user service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user.user');
