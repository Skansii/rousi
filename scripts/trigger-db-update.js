/**
 * Script to trigger database schema update on Vercel
 * 
 * Usage:
 * node scripts/trigger-db-update.js [environment]
 * 
 * Where environment is one of:
 * - local (default)
 * - production
 * - preview
 * - custom (prompts for URL)
 */
require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const targetEnv = args[0] || 'local';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get URL based on environment
function getApiUrl(env) {
  switch (env) {
    case 'production':
      return process.env.PRODUCTION_URL || 'https://your-production-url.vercel.app';
    case 'preview':
      return process.env.PREVIEW_URL || 'https://your-preview-url.vercel.app';
    case 'local':
      return process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    case 'custom':
      return null; // Will prompt for URL
    default:
      return env; // Treat as direct URL
  }
}

// Prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function triggerUpdate() {
  try {
    // Get the appropriate URL
    let apiUrl = getApiUrl(targetEnv);
    
    // If custom or URL not set, prompt for it
    if (!apiUrl) {
      apiUrl = await prompt('Enter the full API URL: ');
    }
    
    // If ADMIN_SECRET isn't set, prompt for it
    let adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.log('\nNo ADMIN_SECRET found in environment variables.');
      adminSecret = await prompt('Enter admin secret: ');
    }
    
    // Confirm before proceeding
    console.log(`\nTarget: ${apiUrl}/api/admin/update-schema`);
    const confirm = await prompt('Proceed with database update? (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      return false;
    }
    
    console.log(`\nTriggering database update at: ${apiUrl}/api/admin/update-schema`);
    
    const headers = {};
    const authToken = process.env.AUTH_TOKEN;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await axios.post(
      `${apiUrl}/api/admin/update-schema`,
      { adminSecret },
      { 
        headers,
        timeout: 30000, // 30 second timeout
      }
    );
    
    console.log('\nUpdate successful!');
    console.log('Server response:', response.data);
    return true;
  } catch (error) {
    console.error('\nError triggering update:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server. Check your connection and the server status.');
    } else {
      // Something happened in setting up the request
      console.error('Error:', error.message);
    }
    
    return false;
  } finally {
    rl.close();
  }
}

// Main execution
triggerUpdate()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 