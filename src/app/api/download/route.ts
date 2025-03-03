import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import _path from 'path';
import _fs from 'fs';
import { executeQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Download API called with URL:', request.url);
    
    // For local development, bypass auth check
    let userId;
    try {
      const { userId: authUserId } = await auth();
      userId = authUserId;
    } catch (error) {
      // During development, bypass authentication
      console.log('Auth check bypassed for development:', error);
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
    console.log('Requested book ID:', bookId);

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    // Get book information from database
    console.log('Querying database for book ID:', bookId);
    const bookResults = await executeQuery(
      'SELECT title, author, format, download_link, file_path FROM books WHERE id = ?',
      [bookId]
    );
    console.log('Database query results:', JSON.stringify(bookResults));

    if (!Array.isArray(bookResults) || bookResults.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Get download link from database result
    const book = bookResults[0] as { 
      title: string; 
      author: string; 
      format: string; 
      download_link: string;
      file_path: string;
    };
    console.log('Found book:', book.title, 'with download link:', book.download_link);
    console.log('File path:', book.file_path);

    // Try to use file_path directly if it exists
    let filePath = book.file_path;
    
    // If no direct file path, try to extract from download_link
    if (!filePath && book.download_link) {
      if (book.download_link.startsWith('/api/download?path=')) {
        try {
          // Extract the path parameter from the download_link
          const linkUrl = new URL('http://localhost' + book.download_link);
          const pathParam = linkUrl.searchParams.get('path');
          if (pathParam) {
            filePath = decodeURIComponent(pathParam);
            console.log('Extracted file path from download_link:', filePath);
          }
        } catch (error) {
          console.error('Error parsing download link:', error);
        }
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File path not available for this book' }, { status: 404 });
    }

    // Update download count
    console.log('Updating download count for book ID:', bookId);
    await executeQuery('UPDATE books SET downloads = downloads + 1 WHERE id = ?', [bookId]);

    // Safety check to prevent directory traversal
    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    // Check if the file exists
    console.log('Checking if file exists:', filePath);
    if (!_fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Create a readable stream for the file
    const fileStream = _fs.createReadStream(filePath);
    
    // Get the file extension to determine the content type
    const ext = _path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.epub') contentType = 'application/epub+zip';
    else if (ext === '.mobi') contentType = 'application/x-mobipocket-ebook';
    
    // Get the filename for Content-Disposition
    const filename = _path.basename(filePath);
    console.log('Sending file:', filename, 'with content type:', contentType);
    
    // Return the file as a downloadable response
    return new NextResponse(fileStream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 