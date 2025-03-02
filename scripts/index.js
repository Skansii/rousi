/**
 * Central export file for all database scripts
 * This makes it easier to import scripts in API routes
 */

const { addDownloadsColumn } = require('./add-downloads-column');
// Import the test script
const testGoogleBooksApi = require('./test-google-books');

module.exports = {
  addDownloadsColumn,
  testGoogleBooksApi,
  // Add other scripts here as they are developed
}; 