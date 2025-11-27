module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    // Check if name + role combination already exists
    if (data.name && data.role) {
      const existingAccounts = await strapi.entityService.findMany('api::account.account', {
        filters: {
          name: data.name,
          role: data.role,
        },
      });

      if (existingAccounts && existingAccounts.length > 0) {
        throw new Error('An account with this name and role combination already exists');
      }
    }

    if (data.password) {
      // Check if password already exists in models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['password'],
      });

      for (const model of models) {
        if (model.password && data.password === model.password) {
          throw new Error('This password is already used by a model');
        }
      }
    }
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // Check if name + role combination already exists (excluding current account)
    if (data.name || data.role) {
      // Get current account to check new combination
      const currentAccount = await strapi.entityService.findOne('api::account.account', where.id, {
        fields: ['name', 'role'],
      });

      const newName = data.name || currentAccount.name;
      const newRole = data.role || currentAccount.role;

      const existingAccounts = await strapi.entityService.findMany('api::account.account', {
        filters: {
          name: newName,
          role: newRole,
          id: { $ne: where.id },
        },
      });

      if (existingAccounts && existingAccounts.length > 0) {
        throw new Error('An account with this name and role combination already exists');
      }
    }

    if (data.password) {
      // Check if password already exists in models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['password'],
      });

      for (const model of models) {
        if (model.password && data.password === model.password) {
          throw new Error('This password is already used by a model');
        }
      }
    }
  },
};
