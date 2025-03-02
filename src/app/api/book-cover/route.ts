import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// Cache object to store already fetched cover images and reduce API calls
// Key format: `${title}-${author}`
const coverCache: Record<string, { coverImage: string; timestamp: number }> = {};

// Cache expiration time: 24 hours
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; 

// Rate limiting variables
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
let googleBooksRequestsInWindow = 0;
let windowStartTime = Date.now();
const MAX_REQUESTS_PER_WINDOW = 50; // Google Books API limits to 100 requests per minute per user

export async function GET(request: NextRequest) {
  try {
    // Dev mode: bypass authentication
    let userId;
    try {
      const { userId: authUserId } = await auth();
      userId = authUserId;
    } catch (_error) {
      // Using dev-user for local development
      userId = 'dev-user';
    }

    // If no user ID is found, and we're not in dev mode with a dev-user, return unauthorized
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const author = searchParams.get('author');

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Check if the cover image is already in the cache
    const cacheKey = `${title}-${author || ''}`;
    if (coverCache[cacheKey] && (Date.now() - coverCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      console.log(`Using cached cover for "${title}"`);
      return NextResponse.json({ coverImage: coverCache[cacheKey].coverImage });
    }

    // Try various methods to find a cover image
    let coverImage = null;

    // 1. First check our database
    coverImage = await tryDatabaseCover(title, author);
    if (coverImage) {
      // Store in cache
      coverCache[cacheKey] = { coverImage, timestamp: Date.now() };
      return NextResponse.json({ coverImage });
    }

    // 2. Try Google Books API
    coverImage = await tryGoogleBooks(title, author);
    if (coverImage) {
      // Store in cache
      coverCache[cacheKey] = { coverImage, timestamp: Date.now() };
      return NextResponse.json({ coverImage });
    }

    // If we still don't have a cover image, return a 404
    return NextResponse.json({ error: 'No cover image found' }, { status: 404 });
  } catch (error) {
    console.error('Error in book cover route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function tryDatabaseCover(title: string, author: string | null): Promise<string | null> {
  try {
    const connection = await getConnection();
    
    // Use LIKE for more flexible matching
    const query = `
      SELECT cover_image 
      FROM books 
      WHERE title LIKE ? 
      ${author ? 'AND author LIKE ?' : ''}
      AND cover_image IS NOT NULL 
      AND cover_image != ''
      LIMIT 1
    `;
    
    const params = [`%${title}%`];
    if (author) params.push(`%${author}%`);
    
    const [rows] = await connection.execute(query, params);
    await connection.end();
    
    // @ts-expect-error - rows from MySQL result might not match expected type
    if (rows && rows.length > 0 && rows[0].cover_image) {
      // @ts-expect-error - rows from MySQL result might not match expected type
      return rows[0].cover_image;
    }
    
    return null;
  } catch (error) {
    console.error('Error querying database for cover:', error);
    return null;
  }
}

async function tryGoogleBooks(title: string, author: string | null): Promise<string | null> {
  try {
    // Check rate limiting
    const now = Date.now();
    if (now - windowStartTime > RATE_LIMIT_WINDOW) {
      // Reset the window if it's expired
      windowStartTime = now;
      googleBooksRequestsInWindow = 0;
    }
    
    if (googleBooksRequestsInWindow >= MAX_REQUESTS_PER_WINDOW) {
      console.log(`Rate limit reached (${MAX_REQUESTS_PER_WINDOW} requests in the last minute). Skipping Google Books API call.`);
      // Rather than failing, we'll just return null and let the caller handle it
      return null;
    }
    
    // Increment the request counter
    googleBooksRequestsInWindow++;
    
    // Construct the query
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    console.log(`Fetching Google Books with API key: ${apiKey ? 'Using API key' : 'No API key'}`);
    
    // Format the query to search for the title and author
    let query = `intitle:${title.replace(/_/g, ' ')}`;
    if (author && author !== 'Unknown Author') {
      query += `+inauthor:${author}`;
    }
    
    // Build the URL with the API key if available
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3${apiKey ? `&key=${apiKey}` : ''}`;
    
    // Use AbortController to set a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`Google Books API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Google Books returned ${data.items?.length || 0} results for "${title}"`);
    
    // Check if we have items
    if (!data.items || data.items.length === 0) {
      return null;
    }
    
    // Look for the book with the best cover image
    for (const item of data.items) {
      if (item.volumeInfo?.imageLinks?.thumbnail) {
        // Replace http with https and zoom=1 with zoom=0 to get a higher quality image
        let imageUrl = item.volumeInfo.imageLinks.thumbnail;
        imageUrl = imageUrl.replace('http://', 'https://');
        
        // Replace zoom level for better quality if we're using Google Books API
        if (imageUrl.includes('books.google.com')) {
          imageUrl = imageUrl.replace('zoom=1', 'zoom=0');
        }
        
        return imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`Google Books API request for "${title}" timed out`);
    } else {
      console.error('Error in tryGoogleBooks:', error);
    }
    return null;
  }
} 