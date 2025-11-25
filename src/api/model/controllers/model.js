'use strict';

/**
 * model controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const bcryptjs = require('bcryptjs');

module.exports = createCoreController('api::model.model', ({ strapi }) => ({
  async find(ctx) {
    // Call the default find method
    return await super.find(ctx);
  },

  async authenticate(ctx) {
    const { password } = ctx.request.body;

    if (!password) {
      ctx.status = 400;
      return { error: 'Password is required' };
    }

    try {
      // Fetch all models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['id', 'documentId', 'name', 'password', 'title'],
      });

      // Try to find a matching model
      for (const model of models) {
        const modelPassword = model.password;

        // Compare plaintext password with hashed password
        if (modelPassword && await bcryptjs.compare(password, modelPassword)) {
          ctx.status = 200;
          return {
            id: model.documentId || model.id,
            name: model.name,
            type: 'model',
          };
        }
      }

      ctx.status = 401;
      return { error: 'Invalid password' };
    } catch (error) {
      strapi.log.error('Authentication error:', error);
      ctx.status = 500;
      return { error: 'Authentication failed' };
    }
  }
}));
