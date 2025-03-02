// This script will update file sizes for existing books
// Usage: node update-file-sizes.js

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const mysql = require('mysql2/promise');

async function updateFileSizes(connection) {
  console.log('Fetching books from database...');
  
  // Get all books with file paths
  const [books] = await connection.execute(
    'SELECT id, title, file_path FROM books WHERE file_path IS NOT NULL'
  );
  
  console.log(`Found ${books.length} books with file paths.`);
  
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const book of books) {
    try {
      // Check if file exists
      if (!fs.existsSync(book.file_path)) {
        console.log(`Warning: File not found: ${book.file_path}`);
        continue;
      }
      
      // Get file size in bytes
      const stats = fs.statSync(book.file_path);
      const fileSizeInBytes = stats.size;
      
      // Update the database
      await connection.execute(
        'UPDATE books SET file_size = ? WHERE id = ?',
        [fileSizeInBytes, book.id]
      );
      
      updatedCount++;
      console.log(`Updated: ${book.title} (${formatFileSize(fileSizeInBytes)})`);
    } catch (error) {
      console.error(`Error updating file size for book ${book.title}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`- Total books processed: ${books.length}`);
  console.log(`- Successfully updated: ${updatedCount}`);
  console.log(`- Errors: ${errorCount}`);
}

// Helper function to format file size for display
function formatFileSize(bytes) {
  if (!bytes) return "Unknown size";
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
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
    await updateFileSizes(connection);
    
    await connection.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 