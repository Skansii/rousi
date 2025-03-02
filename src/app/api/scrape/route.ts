import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { auth } from '@clerk/nextjs/server';

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
    const { bookTitle, author } = await request.json();
    
    if (!bookTitle || !author) {
      return NextResponse.json(
        { error: 'Book title and author are required' },
        { status: 400 }
      );
    }

    // Format search query
    const searchQuery = `${bookTitle} ${author} book review`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    // Launch puppeteer
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(searchUrl);

    // Extract description from search results
    const description = await page.evaluate(() => {
      // Try to find description in search results
      const snippets = Array.from(document.querySelectorAll('.VwiC3b'));
      if (snippets.length > 0) {
        return snippets.slice(0, 3).map(el => el.textContent).join(' ');
      }
      
      return 'No description available.';
    });

    // Close browser
    await browser.close();

    return NextResponse.json({ description }, { status: 200 });
  } catch (error) {
    console.error('Error scraping book info:', error);
    return NextResponse.json(
      { error: 'Failed to scrape book information' },
      { status: 500 }
    );
  }
} 