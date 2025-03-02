// This script will scan a directory of books and add them to the database
// Usage: node import-books.js <directory-path>

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Book metadata extraction - basic version
// In a production scenario, you'd want to use proper metadata extraction libraries
function extractBookMetadata(filePath) {
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase().replace('.', '');
  
  // Try to extract author and title from filename
  // Assuming format like "Author Name - Book Title.pdf" or similar
  let author = 'Unknown Author';
  let title = fileName.replace(`.${extension}`, '');
  
  if (fileName.includes(' - ')) {
    const parts = fileName.split(' - ');
    author = parts[0].trim();
    title = parts[1].replace(`.${extension}`, '').trim();
  }
  
  // Determine language based on directory or filename (simplified)
  // In reality, you might want to use language detection libraries
  let language = 'English'; // Default
  if (filePath.toLowerCase().includes('french') || filePath.toLowerCase().includes('français')) {
    language = 'French';
  } else if (filePath.toLowerCase().includes('german') || filePath.toLowerCase().includes('deutsch')) {
    language = 'German';
  }
  // Add more language detection as needed
  
  // Get file size in bytes
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  
  // Convert to MB for storage
  // Store size in bytes in the database to maintain precision
  // We'll convert to appropriate units when displaying
  
  return {
    title,
    author,
    format: extension.toLowerCase(),
    language,
    file_size: fileSizeInBytes,
    file_path: filePath,
    download_link: `/api/download?path=${encodeURIComponent(filePath)}`
  };
}

async function scanDirectory(directory) {
  const files = await readdir(directory);
  const books = [];
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const fileStat = await stat(filePath);
    
    if (fileStat.isDirectory()) {
      // Recursively scan subdirectories
      const subDirBooks = await scanDirectory(filePath);
      books.push(...subDirBooks);
    } else {
      const extension = path.extname(filePath).toLowerCase();
      // Only process PDF and EPUB files
      if (extension === '.pdf' || extension === '.epub') {
        const metadata = extractBookMetadata(filePath);
        books.push(metadata);
      }
    }
  }
  
  return books;
}

async function createDatabaseSchema(connection) {
  // Check if books table exists, if not create it with updated schema
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      description TEXT,
      cover_image VARCHAR(255),
      download_link VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      format VARCHAR(10) NOT NULL,
      language VARCHAR(50) DEFAULT 'English',
      file_size BIGINT,
      month TINYINT,
      year SMALLINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_month_year (month, year),
      INDEX idx_language (language),
      INDEX idx_format (format)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  
  console.log('Database schema updated successfully');
}

async function importBooks(books, connection) {
  console.log(`Importing ${books.length} books to database...`);
  
  // Get current date for month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  let importedCount = 0;
  
  // First, check if file_path column exists
  try {
    const [columns] = await connection.execute(`SHOW COLUMNS FROM books`);
    const columnNames = columns.map(col => col.Field);
    
    if (!columnNames.includes('file_path')) {
      console.error('Error: file_path column does not exist in the books table.');
      console.error('Please run "node scripts/update-schema.js" to update your database schema first.');
      return;
    }
  } catch (error) {
    console.error('Error checking schema:', error.message);
    return;
  }
  
  for (const book of books) {
    try {
      // Check if book already exists based on file path
      const [existingBooks] = await connection.execute(
        'SELECT id FROM books WHERE file_path = ?',
        [book.file_path]
      );
      
      if (existingBooks.length > 0) {
        console.log(`Book already exists: ${book.title}`);
        continue;
      }
      
      // Insert book into database
      await connection.execute(
        `INSERT INTO books (
          title, author, download_link, file_path, 
          format, language, file_size, month, year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          book.title,
          book.author,
          book.download_link,
          book.file_path,
          book.format,
          book.language,
          book.file_size,
          currentMonth,
          currentYear
        ]
      );
      
      importedCount++;
      console.log(`Imported: ${book.title} by ${book.author} (${formatFileSize(book.file_size)})`);
    } catch (error) {
      console.error(`Error importing book ${book.title}:`, error.message);
    }
  }
  
  console.log(`Import complete. Added ${importedCount} new books.`);
}

// Helper function to format file size for display in the console
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
  if (process.argv.length < 3) {
    console.error('Please provide a directory path: node import-books.js <directory-path>');
    process.exit(1);
  }
  
  const directoryPath = process.argv[2];
  
  if (!fs.existsSync(directoryPath)) {
    console.error(`Directory does not exist: ${directoryPath}`);
    process.exit(1);
  }
  
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
    
    console.log('Connected to database. Updating schema...');
    
    // Check if we need to suggest running update-schema.js
    try {
      const [tables] = await connection.execute("SHOW TABLES LIKE 'books'");
      if (tables.length > 0) {
        // Table exists, check for required columns
        const [columns] = await connection.execute(`SHOW COLUMNS FROM books`);
        const columnNames = columns.map(col => col.Field);
        
        if (!columnNames.includes('file_path') || 
            !columnNames.includes('format') || 
            !columnNames.includes('language') || 
            !columnNames.includes('file_size')) {
          console.log('\n⚠️ WARNING: Your database schema is missing required columns.');
          console.log('Please run this command first to update your schema:');
          console.log('  node scripts/update-schema.js\n');
          await connection.end();
          console.log('Database connection closed');
          process.exit(1);
        }
      }
    } catch (error) {
      // If there's an error, we'll just continue with regular schema creation
      console.log('Schema check failed, attempting to create schema...');
    }
    
    await createDatabaseSchema(connection);
    
    console.log(`Scanning directory: ${directoryPath}`);
    const books = await scanDirectory(directoryPath);
    console.log(`Found ${books.length} books`);
    
    await importBooks(books, connection);
    
    await connection.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 