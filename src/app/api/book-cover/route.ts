import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import axios from 'axios';
import { executeQuery } from '@/lib/db';

// Cache object to store already fetched cover images and reduce API calls
// Key format: `${title}-${author}`
const coverCache: Record<string, { coverImage: string; timestamp: number }> = {};

// Cache expiration time: 1 week (increased from 24 hours)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000; 

// Rate limiting variables
const _RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const _googleBooksRequestsInWindow = 0;
const _windowStartTime = Date.now();
const _MAX_REQUESTS_PER_WINDOW = 40; // Reduced from 50 to stay well below limit

// Constants
const CACHE_DURATION = 604800000; // 1 week in milliseconds
const API_RATE_LIMIT = 40; // Reduced from 50 to be safer
const API_RESET_TIME = 60000; // 1 minute in milliseconds

// Rate limiting
let requestCount = 0;
let lastResetTime = Date.now();
const bookCoverCache = new Map<string, { url: string; timestamp: number }>();

// Default cover images by category - using LoremFlickr for dynamic placeholder generation
const DEFAULT_COVERS = {
  default: 'https://loremflickr.com/320/480/book',
  tech: 'https://loremflickr.com/320/480/technology,book',
  fiction: 'https://loremflickr.com/320/480/novel,book',
  science: 'https://loremflickr.com/320/480/science,book'
};

export async function GET(request: NextRequest) {
  try {
    // Dev mode: bypass authentication
    let _userId;
    try {
      const { userId: authUserId } = await auth();
      _userId = authUserId;
    } catch (_error) {
      // Using dev-user for local development
      _userId = 'dev-user';
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
      return NextResponse.json({ coverImage: cachedCover.url });
    }

    // Try various methods to find a cover image
    let coverImage = null;

    // 1. First check our database
    coverImage = await tryDatabaseCover(title, author);
    if (coverImage) {
      // Store in cache
      coverCache[cacheKey] = { coverImage, timestamp: Date.now() };
      bookCoverCache.set(cacheKey, { url: coverImage, timestamp: Date.now() });
      return NextResponse.json({ coverImage: coverImage });
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
      
      return NextResponse.json({ coverImage: coverImage });
    }

    // 3. Try OpenLibrary as fallback
    coverImage = await tryOpenLibrary(title, author);
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
      
      return NextResponse.json({ coverImage: coverImage });
    }

    // 4. If we still don't have a cover image, return a default cover
    const defaultCover = getDefaultCover(title);
    return NextResponse.json({ coverImage: defaultCover });
  } catch (error) {
    console.error('Error in book cover route:', error);
    return NextResponse.json({ coverImage: DEFAULT_COVERS.default });
  }
}

// Helper to determine a default cover based on book title
function getDefaultCover(title: string): string {
  const lowerTitle = title.toLowerCase();
  const titleHash = hashString(title); // Generate a hash for consistent image selection
  
  if (lowerTitle.includes('ai') || 
      lowerTitle.includes('programming') || 
      lowerTitle.includes('code') || 
      lowerTitle.includes('tech') ||
      lowerTitle.includes('computer')) {
    return `${DEFAULT_COVERS.tech}?lock=${titleHash % 100}`; // Use lock parameter for consistent images
  }
  
  if (lowerTitle.includes('novel') || 
      lowerTitle.includes('fiction') || 
      lowerTitle.includes('story')) {
    return `${DEFAULT_COVERS.fiction}?lock=${titleHash % 100}`;
  }
  
  if (lowerTitle.includes('science') || 
      lowerTitle.includes('physics') || 
      lowerTitle.includes('biology')) {
    return `${DEFAULT_COVERS.science}?lock=${titleHash % 100}`;
  }
  
  return `${DEFAULT_COVERS.default}?lock=${titleHash % 100}`;
}

// Simple string hash function to generate a numeric value from a string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
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
  
  // Remove date patterns, file extensions, and publisher information
  query = cleanBookTitle(query);
  
  // If author is available, add it to the query
  // But first clean it up to improve search results
  if (author && author !== 'Unknown Author') {
    const cleanedAuthor = author
      .replace(/_/g, ' ')
      .replace(/,.*$/, '') // Remove anything after first comma
      .replace(/\s+&\s+.*$/, ''); // Remove co-authors after "&"
    
    // For better results, sometimes it's better to search by title only
    // Especially for very long titles that already contain sufficient information
    if (query.length < 60) {
      query += ` ${cleanedAuthor}`;
    }
  }

  // Trim and limit query length
  query = query.trim().substring(0, 100);

  try {
    console.log(`Fetching Google Books with API key: ${process.env.GOOGLE_BOOKS_API_KEY ? 'Using API key' : 'No API key'}`);
    requestCount++;
    
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
    
    // Define retry logic
    const maxRetries = 2;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount <= maxRetries) {
      try {
        const response = await axios.get(`https://www.googleapis.com/books/v1/volumes`, {
          params: {
            q: query,
            maxResults: 5, // Increased from 3 to 5 to get more potential matches
            key: apiKey,
            fields: 'items(volumeInfo(imageLinks,title,authors))' // Optimize by requesting only needed fields
          },
          timeout: 5000 // 5 second timeout
        });

        const { data } = response;
        console.log(`Google Books returned ${data.totalItems || 0} results for "${title}"`);

        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            if (item.volumeInfo && 
                item.volumeInfo.imageLinks) {
              
              // Get the best available image, using larger ones if available
              const imageUrl = item.volumeInfo.imageLinks.thumbnail || 
                              item.volumeInfo.imageLinks.smallThumbnail;
              
              if (imageUrl) {
                // Convert to HTTPS if needed and get rid of edge=curl parameter
                const cleanedUrl = imageUrl
                  .replace('http://', 'https://')
                  .replace('&edge=curl', '')
                  // If you want to get higher resolution
                  .replace('zoom=1', 'zoom=2');
                  
                return cleanedUrl;
              }
            }
          }
        }
        
        // If we got here, no usable images were found
        return null;
      } catch (error: any) {
        lastError = error;
        // Only retry on network errors or 5xx responses
        if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || 
            (error.response && error.response.status >= 500 && error.response.status < 600))) {
          retryCount++;
          if (retryCount <= maxRetries) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
            continue;
          }
        }
        // Don't retry on other errors
        break;
      }
    }
    
    // Log the error but return null to allow fallback
    if (lastError) {
      if (axios.isAxiosError(lastError) && lastError.response) {
        console.log(`Google Books API error: ${lastError.response.status} ${lastError.response.statusText}`);
      } else {
        console.log(`Error fetching from Google Books API: ${lastError.message || 'Unknown error'}`);
      }
    }
    
    return null;
  } catch (error: any) {
    // Catch-all error handler
    console.log(`Unexpected error in Google Books API: ${error.message || 'Unknown error'}`);
    return null;
  }
}

async function tryOpenLibrary(title: string, author: string | null): Promise<string | null> {
  try {
    const cleanedTitle = cleanBookTitle(title);
    
    // Construct the OpenLibrary query
    const query = encodeURIComponent(`title:${cleanedTitle}${author && author !== 'Unknown Author' ? ` author:${author}` : ''}`);
    
    const response = await axios.get(`https://openlibrary.org/search.json?q=${query}&limit=3`, {
      timeout: 5000
    });
    
    const { data } = response;
    
    if (data.docs && data.docs.length > 0) {
      // Find the first document with a cover_i (cover ID)
      for (const doc of data.docs) {
        if (doc.cover_i) {
          // Construct the cover URL using the cover ID
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        }
      }
    }
    
    return null;
  } catch (error: any) {
    console.log('OpenLibrary fetch failed:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.log(`OpenLibrary returned non-OK response: ${error.response.statusText}`);
    }
    return null;
  }
}

// Helper function to clean book titles
function cleanBookTitle(title: string): string {
  return title
    .replace(/\.(pdf|epub|mobi|azw3|djvu|fb2|doc|docx)$/i, '')
    .replace(/\([0-9]{4}\)$/, '') // Remove year in parentheses at the end
    .replace(/^(.*?)-.*? \([0-9]{4}\)$/, '$1') // Remove publisher and year pattern
    .replace(/^(.*?)-.*? [0-9]{4}$/, '$1') // Remove publisher and year without parentheses
    .replace(/-[^-]*\([0-9]{4}\)$/, '') // Remove publisher with year in parentheses
    .replace(/-[^-]*[0-9]{4}$/, ''); // Remove anything after last dash followed by a year
} 