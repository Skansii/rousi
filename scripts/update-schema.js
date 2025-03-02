// This script will update the database schema to add missing columns
// Usage: node update-schema.js

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function checkAndUpdateSchema(connection) {
  console.log('Checking database schema...');
  
  // First, check which columns exist in the books table
  const [columns] = await connection.execute(`
    SHOW COLUMNS FROM books
  `);
  
  const columnNames = columns.map(col => col.Field);
  console.log('Existing columns:', columnNames.join(', '));
  
  // Check and add missing columns
  const columnsToAdd = [];
  
  if (!columnNames.includes('file_path')) {
    columnsToAdd.push('ADD COLUMN file_path VARCHAR(255) AFTER download_link');
  }
  
  if (!columnNames.includes('format')) {
    columnsToAdd.push('ADD COLUMN format VARCHAR(10) DEFAULT "PDF" AFTER file_path');
  }
  
  if (!columnNames.includes('language')) {
    columnsToAdd.push('ADD COLUMN language VARCHAR(50) DEFAULT "English" AFTER format');
  }
  
  if (!columnNames.includes('file_size')) {
    columnsToAdd.push('ADD COLUMN file_size BIGINT AFTER language');
  } else {
    // If file_size exists but is a FLOAT, convert it to BIGINT
    const fileSize = columns.find(col => col.Field === 'file_size');
    if (fileSize && !fileSize.Type.includes('bigint')) {
      columnsToAdd.push('MODIFY COLUMN file_size BIGINT');
    }
  }
  
  // Execute ALTER TABLE statement if there are columns to add
  if (columnsToAdd.length > 0) {
    console.log(`Adding ${columnsToAdd.length} missing columns to books table...`);
    
    const alterStatement = `
      ALTER TABLE books
      ${columnsToAdd.join(', ')}
    `;
    
    await connection.execute(alterStatement);
    console.log('Schema updated successfully!');
  } else {
    console.log('No schema updates needed.');
  }
  
  // Add indexes if they don't exist
  const indexesToAdd = [];
  
  try {
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM books
    `);
    
    const indexNames = indexes.map(idx => idx.Key_name);
    
    if (!indexNames.includes('idx_language')) {
      indexesToAdd.push('ADD INDEX idx_language (language)');
    }
    
    if (!indexNames.includes('idx_format')) {
      indexesToAdd.push('ADD INDEX idx_format (format)');
    }
    
    if (!indexNames.includes('idx_month_year')) {
      indexesToAdd.push('ADD INDEX idx_month_year (month, year)');
    }
    
    if (indexesToAdd.length > 0) {
      console.log(`Adding ${indexesToAdd.length} missing indexes...`);
      
      const alterIndexStatement = `
        ALTER TABLE books
        ${indexesToAdd.join(', ')}
      `;
      
      await connection.execute(alterIndexStatement);
      console.log('Indexes added successfully!');
    } else {
      console.log('No index updates needed.');
    }
  } catch (error) {
    console.error('Error checking indexes:', error.message);
  }
}

async function main() {
  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('Connected to database.');
    await checkAndUpdateSchema(connection);
    
    await connection.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 