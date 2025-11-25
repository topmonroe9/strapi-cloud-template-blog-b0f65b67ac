'use strict';

module.exports = {
  async getAllReports(ctx) {
    try {
      // Fetch all reports with populated relations
      const reports = await strapi.entityService.findMany('api::report.report', {
        populate: {
          model: {
            fields: ['id', 'documentId', 'name']
          },
          users: {
            fields: ['id', 'documentId', 'name']
          }
        },
        sort: { createdAt: 'desc' }
      });

      return reports;
    } catch (error) {
      console.error('Error fetching all reports:', error);
      return ctx.internalServerError('Failed to fetch reports');
    }
  },
};
