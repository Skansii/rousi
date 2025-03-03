import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import path from 'path';
import fs from 'fs';
import { executeQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // For local development, bypass auth check
    let userId;
    try {
      const { userId: authUserId } = await auth();
      userId = authUserId;
    } catch (_error) {
      // During development, bypass authentication
      userId = 'dev-user';
    }

    // Commented out for local development
    // if (!userId) {
    //   return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
    //     status: 401,
    //     headers: { 'Content-Type': 'application/json' },
    //   });
    // }

    const url = new URL(request.url);
    const bookId = url.searchParams.get('id');

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    // Get book information from database
    const bookResults = await executeQuery(
      'SELECT title, author, format, download_link FROM books WHERE id = ?',
      [bookId]
    );

    if (!Array.isArray(bookResults) || bookResults.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Get download link from database result
    const book = bookResults[0] as { 
      title: string; 
      author: string; 
      format: string; 
      download_link: string 
    };

    // Update download count
    await executeQuery('UPDATE books SET downloads = downloads + 1 WHERE id = ?', [bookId]);

    // Redirect to the download link
    return NextResponse.redirect(book.download_link);
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 