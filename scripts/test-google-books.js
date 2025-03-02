// This script tests the Google Books API with our API key
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function testGoogleBooksApi() {
  console.log('--- Google Books API Test ---');
  
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_BOOKS_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  console.log(`API Key found: ${apiKey.substring(0, 5)}...${apiKey.slice(-4)}`);
  
  // Test books to search for
  const testBooks = [
    { title: 'Clean Code', author: 'Robert C. Martin' },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt' },
    { title: '1984', author: 'George Orwell' }
  ];
  
  for (const book of testBooks) {
    try {
      console.log(`\nSearching for: "${book.title}" by ${book.author}`);
      const query = `intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&key=${apiKey}`;
      
      console.log(`Request URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
      
      const response = await axios.get(url);
      const { items, totalItems } = response.data;
      
      console.log(`Total items found: ${totalItems}`);
      
      if (items && items.length > 0) {
        console.log('First result:');
        const firstBook = items[0].volumeInfo;
        console.log(`- Title: ${firstBook.title}`);
        console.log(`- Authors: ${firstBook.authors?.join(', ') || 'Unknown'}`);
        console.log(`- Publisher: ${firstBook.publisher || 'Unknown'}`);
        console.log(`- Published Date: ${firstBook.publishedDate || 'Unknown'}`);
        
        if (firstBook.imageLinks) {
          console.log('- Image links found:');
          Object.entries(firstBook.imageLinks).forEach(([key, value]) => {
            console.log(`  * ${key}: ${value}`);
          });
        } else {
          console.log('- No image links available');
        }
      } else {
        console.log('No results found');
      }
    } catch (error) {
      console.error(`Error searching for ${book.title}:`, error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }
  
  return 'Test completed';
}

// Run the test if this script is executed directly
if (require.main === module) {
  testGoogleBooksApi()
    .then(() => console.log('\nTest completed'))
    .catch(err => console.error('\nTest failed:', err));
}

module.exports = testGoogleBooksApi; 