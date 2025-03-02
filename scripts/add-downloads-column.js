const mysql = require('mysql2/promise');
require('dotenv').config();

// Get database config, checking both naming conventions
function getDatabaseConfig() {
  // Check both naming conventions (DATABASE_* and MYSQL_*)
  const config = {
    host: process.env.DATABASE_HOST || process.env.MYSQL_HOST,
    user: process.env.DATABASE_USERNAME || process.env.MYSQL_USER,
    password: process.env.DATABASE_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DATABASE_NAME || process.env.MYSQL_DATABASE,
    port: parseInt(process.env.DATABASE_PORT || process.env.MYSQL_PORT || '3306', 10),
    // Default SSL configuration that works with most cloud DB providers
    ssl: process.env.DATABASE_SSL === 'false' ? false : {
      rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED !== 'false'
    }
  };

  // Validate required fields
  const missingFields = Object.entries(config)
    .filter(([key, value]) => !value && key !== 'ssl')
    .map(([key]) => key);

  if (missingFields.length > 0) {
    throw new Error(`Missing required database configuration: ${missingFields.join(', ')}`);
  }

  return config;
}

// Check if a column exists in a table
async function columnExists(connection, tableName, columnName) {
  try {
    const [rows] = await connection.execute(
      `SHOW COLUMNS FROM ${tableName} LIKE ?`,
      [columnName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking if column '${columnName}' exists:`, error.message);
    throw error;
  }
}

// Retry function with exponential backoff
async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 1000;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Add downloads column if it doesn't exist
async function addDownloadsColumn() {
  let connection;
  
  try {
    const config = getDatabaseConfig();
    console.log(`Connecting to database at ${config.host}...`);
    
    // Connect to the database with retries
    connection = await withRetry(
      async () => {
        console.log('Attempting database connection...');
        return await mysql.createConnection(config);
      },
      { maxRetries: 3, initialDelay: 2000 }
    );

    console.log('Connected to the database. Checking for missing columns...');

    // Get existing tables
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    if (!tableNames.includes('books')) {
      console.error('Error: books table does not exist in the database!');
      console.log('Available tables:', tableNames.join(', '));
      return false;
    }

    // Check if 'downloads' column exists in books table
    const downloadsExists = await columnExists(connection, 'books', 'downloads');
    
    if (downloadsExists) {
      console.log('downloads column already exists in the books table.');
    } else {
      console.log('Adding downloads column to books table...');
      await connection.execute(
        'ALTER TABLE books ADD COLUMN downloads INT NOT NULL DEFAULT 0'
      );
      console.log('downloads column added successfully!');
    }

    // Also check for other required columns
    const requiredColumns = [
      { name: 'format', type: 'VARCHAR(255)' },
      { name: 'language', type: 'VARCHAR(255)' },
      { name: 'file_path', type: 'VARCHAR(255)' },
      { name: 'file_size', type: 'BIGINT' }
    ];
    
    for (const column of requiredColumns) {
      const exists = await columnExists(connection, 'books', column.name);
      
      if (!exists) {
        console.log(`Adding missing ${column.name} column to books table...`);
        
        await connection.execute(
          `ALTER TABLE books ADD COLUMN ${column.name} ${column.type}`
        );
        console.log(`${column.name} column added successfully!`);
      } else {
        console.log(`${column.name} column already exists.`);
      }
    }

    console.log('Database schema update complete!');
    return true;
  } catch (error) {
    console.error('Error updating database schema:', error);
    return false;
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing database connection:', err);
      }
    }
  }
}

// If this script is run directly
if (require.main === module) {
  addDownloadsColumn()
    .then(success => {
      console.log(success ? 'Script completed successfully!' : 'Script completed with errors.');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { addDownloadsColumn };
} 