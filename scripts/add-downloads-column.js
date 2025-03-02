const mysql = require('mysql2/promise');
require('dotenv').config();

// Check if a column exists in a table
async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SHOW COLUMNS FROM ${tableName} LIKE ?`,
    [columnName]
  );
  return rows.length > 0;
}

// Add downloads column if it doesn't exist
async function addDownloadsColumn() {
  try {
    // Create connection with SSL (for production PlanetScale)
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      port: process.env.DATABASE_PORT || 3306,
      ssl: {
        rejectUnauthorized: true
      }
    });

    console.log('Connected to the database. Checking for missing columns...');

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
    const requiredColumns = ['format', 'language', 'file_path', 'file_size'];
    
    for (const column of requiredColumns) {
      const exists = await columnExists(connection, 'books', column);
      
      if (!exists) {
        console.log(`Adding missing ${column} column to books table...`);
        
        let columnDefinition;
        switch (column) {
          case 'format':
          case 'language':
          case 'file_path':
            columnDefinition = `VARCHAR(255)`;
            break;
          case 'file_size':
            columnDefinition = `BIGINT`;
            break;
          default:
            columnDefinition = `VARCHAR(255)`;
        }
        
        await connection.execute(
          `ALTER TABLE books ADD COLUMN ${column} ${columnDefinition}`
        );
        console.log(`${column} column added successfully!`);
      }
    }

    await connection.end();
    console.log('Database schema update complete!');
    return true;
  } catch (error) {
    console.error('Error updating database schema:', error);
    return false;
  }
}

// Run the function
addDownloadsColumn()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 