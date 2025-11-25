'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/users/authenticate',
      handler: 'user.authenticate',
      config: {
        auth: false,
      }
    }
  ]
};
