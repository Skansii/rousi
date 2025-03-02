import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs';
import path from 'path';
import { executeQuery } from '@/lib/db';

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
  const filePath = searchParams.get('path');
  const bookId = searchParams.get('id');

  try {
    let fileToServe = '';
    
    // If filePath is provided directly (less secure, only for testing)
    if (filePath) {
      fileToServe = filePath;
    } 
    // If bookId is provided (more secure, for production)
    else if (bookId) {
      // Look up file path in database
      const books = await executeQuery(
        'SELECT file_path FROM books WHERE id = ?',
        [bookId]
      );
      
      if (!Array.isArray(books) || books.length === 0 || !(books[0] as any).file_path) {
        return NextResponse.json(
          { error: 'Book not found' },
          { status: 404 }
        );
      }
      
      fileToServe = (books[0] as any).file_path;
      
      // Try to increment download count, but don't let it block the download if it fails
      try {
        // First check if downloads column exists
        const [columns] = await executeQuery(
          'SHOW COLUMNS FROM books LIKE ?',
          ['downloads']
        ) as unknown[];
        
        // Only try to update if the column exists
        if (Array.isArray(columns) && columns.length > 0) {
          await executeQuery(
            'UPDATE books SET downloads = IFNULL(downloads, 0) + 1 WHERE id = ?',
            [bookId]
          );
        } else {
          console.info('Downloads column does not exist, skipping counter update');
        }
      } catch (counterError) {
        // Just log the error but continue with serving the file
        console.warn('Could not update download counter:', counterError);
      }
    } else {
      return NextResponse.json(
        { error: 'No file path or book ID provided' },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(fileToServe)) {
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      );
    }

    // Get file info
    const stat = fs.statSync(fileToServe);
    const fileName = path.basename(fileToServe);
    const fileExtension = path.extname(fileToServe).toLowerCase();
    
    // Set content type based on file extension
    let contentType = 'application/octet-stream'; // Default
    if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExtension === '.epub') {
      contentType = 'application/epub+zip';
    }
    
    // Read file
    const file = fs.readFileSync(fileToServe);
    
    // Create response
    const response = new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stat.size.toString()
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
} 