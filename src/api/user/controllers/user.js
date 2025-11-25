'use strict';

/**
 * user controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const bcryptjs = require('bcryptjs');

module.exports = createCoreController('api::user.user', ({ strapi }) => ({
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
      // Fetch all users
      const users = await strapi.entityService.findMany('api::user.user', {
        fields: ['id', 'documentId', 'name', 'password'],
      });

      // Try to find a matching user
      for (const user of users) {
        const userPassword = user.password;

        // Compare plaintext password with hashed password
        if (userPassword && await bcryptjs.compare(password, userPassword)) {
          ctx.status = 200;
          return {
            id: user.documentId || user.id,
            name: user.name,
            type: 'user',
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
