import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import axios from 'axios';
import { executeQuery } from '@/lib/db';

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

// Constants
const CACHE_DURATION = 604800000; // 1 week in milliseconds
const API_RATE_LIMIT = 50; // Requests per minute
const API_RESET_TIME = 60000; // 1 minute in milliseconds

// Rate limiting
let requestCount = 0;
let lastResetTime = Date.now();
const bookCoverCache = new Map<string, { url: string; timestamp: number }>();

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

    // Check cache first
    const cachedCover = bookCoverCache.get(cacheKey);
    
    if (cachedCover && Date.now() - cachedCover.timestamp < CACHE_DURATION) {
      console.log(`Using cached cover for "${title}"`);
      return NextResponse.json({ coverUrl: cachedCover.url });
    }

    // Try various methods to find a cover image
    let coverImage = null;

    // 1. First check our database
    coverImage = await tryDatabaseCover(title, author);
    if (coverImage) {
      // Store in cache
      coverCache[cacheKey] = { coverImage, timestamp: Date.now() };
      bookCoverCache.set(cacheKey, { url: coverImage, timestamp: Date.now() });
      return NextResponse.json({ coverUrl: coverImage });
    }

    // 2. Try Google Books API
    coverImage = await tryGoogleBooks(title, author);
    if (coverImage) {
      // Store in cache
      coverCache[cacheKey] = { coverImage, timestamp: Date.now() };
      bookCoverCache.set(cacheKey, { url: coverImage, timestamp: Date.now() });
      
      // Store in database for future use
      try {
        await executeQuery(
          'INSERT INTO book_covers (title, author, cover_url, timestamp) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE cover_url = VALUES(cover_url), timestamp = NOW()',
          [title, author || 'Unknown Author', coverImage]
        );
      } catch (_dbError) {
        // Ignore database errors - we still have the image URL
      }
      
      return NextResponse.json({ coverUrl: coverImage });
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
      SELECT cover_url 
      FROM book_covers 
      WHERE title LIKE ? 
      ${author ? 'AND author LIKE ?' : ''}
      AND cover_url IS NOT NULL 
      AND cover_url != ''
      LIMIT 1
    `;
    
    const params = [`%${title}%`];
    if (author) params.push(`%${author}%`);
    
    const [rows] = await connection.execute(query, params);
    await connection.end();
    
    // @ts-expect-error - rows from MySQL result might not match expected type
    if (rows && rows.length > 0 && rows[0].cover_url) {
      // @ts-expect-error - rows from MySQL result might not match expected type
      return rows[0].cover_url;
    }
    
    return null;
  } catch (error) {
    console.error('Error querying database for cover:', error);
    return null;
  }
}

async function tryGoogleBooks(title: string, author: string | null): Promise<string | null> {
  // Check rate limit
  const now = Date.now();
  if (now - lastResetTime > API_RESET_TIME) {
    requestCount = 0;
    lastResetTime = now;
  }

  if (requestCount >= API_RATE_LIMIT) {
    console.log(`Rate limit reached (${API_RATE_LIMIT} requests in the last minute). Skipping Google Books API call.`);
    return null;
  }

  // Construct search query
  let query = title.replace(/-/g, ' ');
  if (author && author !== 'Unknown Author') {
    query += ` ${author.replace(/_/g, ' ')}`;
  }

  // Clean up the query by removing file extensions and publication year patterns
  query = query
    .replace(/\.(pdf|epub|mobi|azw3|djvu|fb2|doc|docx)$/i, '')
    .replace(/\([0-9]{4}\)$/, '') // Remove year in parentheses at the end
    .replace(/^(.*?)-.*? \([0-9]{4}\)$/, '$1') // Remove publisher and year pattern
    .replace(/^(.*?)-.*? [0-9]{4}$/, '$1'); // Remove publisher and year without parentheses

  try {
    console.log(`Fetching Google Books with API key: ${process.env.GOOGLE_BOOKS_API_KEY ? 'Using API key' : 'No API key'}`);
    requestCount++;
    
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes`, {
      params: {
        q: query,
        maxResults: 3,
        key: apiKey
      },
      timeout: 5000 // 5 second timeout
    });

    const { data } = response;
    console.log(`Google Books returned ${data.totalItems} results for "${title}"`);

    if (data.totalItems > 0 && data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item.volumeInfo && 
            item.volumeInfo.imageLinks && 
            (item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail)) {
          
          // Get the largest available image
          const imageUrl = item.volumeInfo.imageLinks.thumbnail || 
                           item.volumeInfo.imageLinks.smallThumbnail;
          
          // Convert to HTTPS if needed and get rid of edge=curl parameter
          return imageUrl.replace('http://', 'https://').replace('&edge=curl', '');
        }
      }
    }
    
    return null;
  } catch (error) {
    // Log the error but return null to allow fallback
    if (axios.isAxiosError(error) && error.response) {
      console.log(`Google Books API error: ${error.response.status} ${error.response.statusText}`);
    } else {
      console.log(`Error fetching from Google Books API: ${error}`);
    }
    return null;
  }
} 