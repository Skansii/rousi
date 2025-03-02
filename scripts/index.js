/**
 * Central export file for all database scripts
 * This makes it easier to import scripts in API routes
 */

const { addDownloadsColumn } = require('./add-downloads-column');

module.exports = {
  addDownloadsColumn,
  // Add other scripts here as they are developed
}; 