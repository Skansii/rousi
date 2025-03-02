const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables from .env.local
const dotenvPath = path.resolve(process.cwd(), '.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(dotenvPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function addDownloadsColumn() {
  // Create database connection using DATABASE_URL from .env.local
  let connection;
  
  try {
    if (process.env.DATABASE_URL) {
      console.log('Using DATABASE_URL from environment...');
      connection = await mysql.createConnection(process.env.DATABASE_URL);
    } else {
      console.log('Using individual database parameters...');
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rousi_app',
      });
    }
    
    console.log('Connected to database. Checking if downloads column exists...');
    
    // Check if the downloads column already exists
    const [columns] = await connection.execute(`SHOW COLUMNS FROM books`);
    const columnNames = columns.map(col => col.Field);
    
    if (columnNames.includes('downloads')) {
      console.log('Downloads column already exists.');
    } else {
      console.log('Adding downloads column to books table...');
      await connection.execute(`
        ALTER TABLE books 
        ADD COLUMN downloads INT DEFAULT 0 AFTER file_size
      `);
      console.log('Downloads column added successfully!');
      
      // Initialize with random values for demo purposes
      console.log('Initializing download counts with random values for demo...');
      await connection.execute(`
        UPDATE books 
        SET downloads = FLOOR(RAND() * 100)
      `);
      console.log('Download counts initialized!');
    }
    
    // Update the API download endpoint to increment download count (instructions)
    console.log('\nIMPORTANT: To track actual downloads, you need to update the download API endpoint.');
    console.log('Add this code to src/app/api/download/route.ts after fetching the book:');
    console.log('```');
    console.log('// Increment download count');
    console.log('await executeQuery(');
    console.log('  "UPDATE books SET downloads = downloads + 1 WHERE id = ?",');
    console.log('  [bookId]');
    console.log(');');
    console.log('```');
    
  } catch (error) {
    console.error('Error updating database schema:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the function
addDownloadsColumn().catch(console.error); 