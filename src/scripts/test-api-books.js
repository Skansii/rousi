import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

// Set a timeout for the request (5 seconds)
const TIMEOUT = 5000;

async function fetchBooksFromApi() {
  console.log('Fetching books from API...');
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/books?page=1&limit=10`;
    
    console.log(`Making request to: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, {
      timeout: TIMEOUT,
      headers: {
        // You might need to set authentication headers here in a real app
        'Content-Type': 'application/json',
      }
    });
    
    if (response.status === 200) {
      console.log('API Response Status:', response.status);
      console.log('Total Books:', response.data.total);
      console.log('Books Retrieved:', response.data.books.length);
      
      if (response.data.books.length > 0) {
        console.log('\nSample Book:');
        console.log(JSON.stringify(response.data.books[0], null, 2));
      } else {
        console.log('\nNo books returned from API.');
      }
    } else {
      console.error('Unexpected response status:', response.status);
    }
  } catch (error) {
    console.error('Error fetching books:');
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      console.error(error.request);
    } else {
      // Something happened in setting up the request
      console.error('Error message:', error.message);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nConnection refused. Is the server running?');
    }
    
    if (error.code === 'ETIMEDOUT') {
      console.error(`\nRequest timed out after ${TIMEOUT}ms`);
    }
  }
}

// Execute the function
fetchBooksFromApi().then(() => {
  console.log('\nTest complete');
}); 