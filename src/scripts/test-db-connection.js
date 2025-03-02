// Load environment variables from .env.local
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Explicitly load the .env.local file
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log(`Loading environment variables from ${envLocalPath}`);
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else {
  console.warn('.env.local file not found');
}

async function getConnection() {
  console.log('Connecting to database with these parameters:');
  console.log(`Host: ${process.env.MYSQL_HOST}`);
  console.log(`Database: ${process.env.MYSQL_DATABASE}`);
  console.log(`User: ${process.env.MYSQL_USER}`);
  console.log(`Password: ${process.env.MYSQL_PASSWORD ? '******' : 'Not set'}`);
  
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

async function executeQuery(query, params = []) {
  try {
    const connection = await getConnection();
    console.log(`Executing query: ${query}`);
    console.log(`With params: ${JSON.stringify(params)}`);
    
    const [results] = await connection.execute(query, params);
    await connection.end();
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

async function checkDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    const connection = await getConnection();
    console.log('Connection successful!');
    await connection.end();
    return true;
  } catch (error) {
    console.error('Connection failed:', error);
    return false;
  }
}

async function describeTable(tableName) {
  try {
    console.log(`Checking structure of table: ${tableName}`);
    const results = await executeQuery(`DESCRIBE ${tableName}`);
    console.log('Table structure:');
    console.table(results);
    return results;
  } catch (error) {
    console.error(`Failed to describe table ${tableName}:`, error);
    return null;
  }
}

async function getBookCount() {
  try {
    console.log('Getting total book count...');
    const results = await executeQuery('SELECT COUNT(*) as count FROM books');
    console.log(`Total books in database: ${results[0].count}`);
    return results[0].count;
  } catch (error) {
    console.error('Failed to get book count:', error);
    return -1;
  }
}

async function getSampleBooks(limit = 5) {
  try {
    console.log(`Getting ${limit} sample books...`);
    const books = await executeQuery(`
      SELECT id, title, author, format, language, file_path 
      FROM books 
      LIMIT ?
    `, [limit]);
    
    console.log('Sample books:');
    console.table(books);
    return books;
  } catch (error) {
    console.error('Failed to get sample books:', error);
    return [];
  }
}

async function main() {
  console.log('=== DATABASE DIAGNOSTIC SCRIPT ===');
  
  const connected = await checkDatabaseConnection();
  if (!connected) {
    console.error('Database connection failed. Exiting script.');
    process.exit(1);
  }
  
  await describeTable('books');
  const bookCount = await getBookCount();
  
  if (bookCount > 0) {
    await getSampleBooks(5);
  } else {
    console.log('No books found in the database.');
  }
  
  console.log('=== DIAGNOSTIC COMPLETE ===');
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 