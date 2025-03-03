import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import axios from 'axios';

export async function POST(request: Request) {
  const { userId } = await auth();
  
  // Check if user is authenticated
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const {
      title,
      author,
      description,
      cover_image,
      download_link,
      month,
      year
    } = await request.json();
    
    // Validate inputs
    if (!title || !author || !download_link || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If no description is provided, try to scrape it
    let finalDescription = description;
    if (!description) {
      try {
        const scrapeResponse = await axios.post(`${process.env.NEXT_PUBLIC_URL}/api/scrape`, {
          bookTitle: title,
          author: author
        });
        
        finalDescription = scrapeResponse.data.description;
      } catch (scrapeError) {
        console.error('Error scraping description:', scrapeError);
        finalDescription = 'No description available.';
      }
    }

    // Insert book into database
    const result = await executeQuery(
      `INSERT INTO books (title, author, description, cover_image, download_link, month, year, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, author, finalDescription, cover_image, download_link, month, year]
    );

    // Define the type for the result
    interface InsertResult {
      insertId: number;
    }
    
    return NextResponse.json({ success: true, bookId: (result as InsertResult).insertId }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error adding book:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to add book', 
        message: errorMessage
      },
      { status: 500 }
    );
  }
} 