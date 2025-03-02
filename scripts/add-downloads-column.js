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
    // First try: MariaDB doesn't always support parameters in SHOW COLUMNS
    // Safely escape column name to prevent SQL injection
    const safeColumnName = columnName.replace(/[^\w]/g, '');
    
    try {
      const [rows] = await connection.execute(
        `SHOW COLUMNS FROM ${tableName} LIKE '${safeColumnName}'`
      );
      return rows.length > 0;
    } catch (innerError) {
      console.log(`SHOW COLUMNS approach failed, trying alternative method for ${columnName}...`);
      
      // Second try: Use INFORMATION_SCHEMA as a more compatible alternative
      const [infoRows] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
      );
      return infoRows.length > 0;
    }
  } catch (error) {
    console.error(`Error checking if column '${columnName}' exists:`, error.message);
    // Return false instead of throwing to make the script more robust
    return false;
  }
}

// Check if a table exists
async function tableExists(connection, tableName) {
  try {
    // First attempt: SHOW TABLES
    try {
      const [tables] = await connection.execute('SHOW TABLES');
      const tableNames = tables.map(t => Object.values(t)[0]);
      return tableNames.includes(tableName);
    } catch (innerError) {
      console.log('SHOW TABLES approach failed, trying alternative method...');
      
      // Second attempt: INFORMATION_SCHEMA
      const [rows] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      return rows.length > 0;
    }
  } catch (error) {
    console.error(`Error checking if table '${tableName}' exists:`, error.message);
    return false;
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

// Create a column using ALTER TABLE with better compatibility
async function createColumn(connection, tableName, columnName, columnDefinition) {
  try {
    console.log(`Adding ${columnName} column to ${tableName} table...`);
    
    // Try the simple approach first
    try {
      await connection.execute(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
      );
    } catch (innerError) {
      console.log(`Standard ALTER TABLE failed, trying with IF NOT EXISTS syntax...`);
      
      // Some MariaDB versions support IF NOT EXISTS
      try {
        await connection.execute(
          `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinition}`
        );
      } catch (innerError2) {
        // Last resort: manually check and add
        console.log(`IF NOT EXISTS syntax failed too, trying manual check and add...`);
        
        const exists = await columnExists(connection, tableName, columnName);
        if (!exists) {
          await connection.query(
            `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
          );
        }
      }
    }
    
    console.log(`${columnName} column added successfully!`);
    return true;
  } catch (error) {
    console.error(`Error adding ${columnName} column:`, error.message);
    return false;
  }
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

    // Check if books table exists
    const booksTableExists = await tableExists(connection, 'books');
    if (!booksTableExists) {
      console.error('Error: books table does not exist in the database!');
      try {
        // Try to list available tables for debugging
        const [tables] = await connection.execute('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Available tables:', tableNames.join(', '));
      } catch (error) {
        console.error('Could not list available tables:', error.message);
      }
      return false;
    }
    
    console.log('Found books table. Checking columns...');

    // Check if 'downloads' column exists in books table
    const downloadsExists = await columnExists(connection, 'books', 'downloads');
    
    if (downloadsExists) {
      console.log('downloads column already exists in the books table.');
    } else {
      await createColumn(connection, 'books', 'downloads', 'INT NOT NULL DEFAULT 0');
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
        await createColumn(connection, 'books', column.name, column.type);
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