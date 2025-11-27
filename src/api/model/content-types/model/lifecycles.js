module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (data.password) {
      // Check if password already exists in accounts (plain text comparison)
      const accounts = await strapi.entityService.findMany('api::account.account', {
        fields: ['password'],
      });

      for (const account of accounts) {
        if (account.password && account.password === data.password) {
          const error = new Error('Этот пароль уже используется аккаунтом. Пожалуйста, выберите другой пароль.');
          error.name = 'ValidationError';
          throw error;
        }
      }

      // Check if password already exists in other models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['id', 'password'],
      });

      for (const model of models) {
        if (model.password && model.password === data.password) {
          const error = new Error('Этот пароль уже используется другой моделью. Пожалуйста, выберите другой пароль.');
          error.name = 'ValidationError';
          throw error;
        }
      }

      // Keep password as plain text (no hashing)
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;

    if (data.password) {
      // Get current model's ID to exclude it from check
      const currentModelId = event.params.where?.id;

      // Check if password already exists in accounts (plain text comparison)
      const accounts = await strapi.entityService.findMany('api::account.account', {
        fields: ['password'],
      });

      for (const account of accounts) {
        if (account.password && account.password === data.password) {
          const error = new Error('Этот пароль уже используется аккаунтом. Пожалуйста, выберите другой пароль.');
          error.name = 'ValidationError';
          throw error;
        }
      }

      // Check if password already exists in other models
      const models = await strapi.entityService.findMany('api::model.model', {
        fields: ['id', 'password'],
      });

      for (const model of models) {
        // Skip current model
        if (model.id !== currentModelId && model.password && model.password === data.password) {
          const error = new Error('Этот пароль уже используется другой моделью. Пожалуйста, выберите другой пароль.');
          error.name = 'ValidationError';
          throw error;
        }
      }

      // Keep password as plain text (no hashing)
    }
  },
};
