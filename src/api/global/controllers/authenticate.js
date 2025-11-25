'use strict';

const bcryptjs = require('bcryptjs');

module.exports = {
  async authenticate(ctx) {
    const { password } = ctx.request.body;

    if (!password) {
      return ctx.badRequest('Password is required');
    }

    try {
      // Try to authenticate with users first
      const users = await strapi.entityService.findMany('api::user.user', {
        fields: ['id', 'documentId', 'name', 'password', 'isAdmin'],
      });

      for (const user of users) {
        const userPassword = user.password;
        if (userPassword && password === userPassword) {
          return {
            id: user.documentId || user.id,
            name: user.name,
            type: 'user',
            isAdmin: user.isAdmin || false,
          };
        }
      }

      // Try to authenticate with models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['id', 'documentId', 'name', 'password'],
      });

      for (const model of models) {
        const modelPassword = model.password;
        if (modelPassword && password === modelPassword) {
          return {
            id: model.documentId || model.id,
            name: model.name,
            type: 'model',
          };
        }
      }

      return ctx.unauthorized('Invalid password');
    } catch (error) {
      console.error('Authentication error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },
};
