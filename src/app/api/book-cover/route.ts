import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  
  // Check if user is authenticated
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title');
  const author = searchParams.get('author');
  
  if (!title) {
    return NextResponse.json(
      { error: 'Title parameter is required' },
      { status: 400 }
    );
  }

  try {
    // First try Open Library API with a timeout
    let coverUrl = await tryOpenLibrary(title, author);
    
    // If not found, try Google Books API
    if (!coverUrl) {
      coverUrl = await tryGoogleBooks(title, author);
    }
    
    // If still not found, use placeholder
    if (!coverUrl) {
      return NextResponse.json(
        { coverUrl: null, message: 'No cover found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ coverUrl }, { status: 200 });
  } catch (error) {
    console.error('Error fetching book cover:', error);
    return NextResponse.json(
      { coverUrl: null, error: 'Failed to fetch book cover' },
      { status: 500 }
    );
  }
}

async function tryOpenLibrary(title: string, author: string | null): Promise<string | null> {
  try {
    const query = encodeURIComponent(`title:${title}${author ? ` author:${author}` : ''}`);
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Rousi Book Club/1.0 (educational project)'
      }
    }).catch(err => {
      console.warn('OpenLibrary fetch failed:', err.message);
      return null;
    });
    
    clearTimeout(timeoutId);
    
    if (!response || !response.ok) {
      console.warn('OpenLibrary returned non-OK response:', response?.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0 && data.docs[0].cover_i) {
      const coverId = data.docs[0].cover_i;
      return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    }
    
    return null;
  } catch (error) {
    console.error('Open Library API error:', error);
    return null;
  }
}

async function tryGoogleBooks(title: string, author: string | null): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${title}${author ? ` ${author}` : ''}`);
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Rousi Book Club/1.0 (educational project)'
      }
    }).catch(err => {
      console.warn('Google Books fetch failed:', err.message);
      return null;
    });
    
    clearTimeout(timeoutId);
    
    if (!response || !response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0 && 
        data.items[0].volumeInfo && 
        data.items[0].volumeInfo.imageLinks &&
        data.items[0].volumeInfo.imageLinks.thumbnail) {
      // Return HTTPS version of the URL
      return data.items[0].volumeInfo.imageLinks.thumbnail.replace('http://', 'https://');
    }
    
    return null;
  } catch (error) {
    console.error('Google Books API error:', error);
    return null;
  }
} 