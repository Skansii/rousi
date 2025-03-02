import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as crypto from 'crypto';

// Generate a random pastel color for book cover background
function getRandomPastelColor(seed: string) {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  const r = parseInt(hash.substring(0, 2), 16) % 156 + 100; // 100-255
  const g = parseInt(hash.substring(2, 4), 16) % 156 + 100; // 100-255
  const b = parseInt(hash.substring(4, 6), 16) % 156 + 100; // 100-255
  return `rgb(${r},${g},${b})`;
}

// Generate SVG placeholder for book cover
function generatePlaceholderSVG(title: string, author: string) {
  // Clean and truncate inputs
  const cleanTitle = title.replace(/[<>]/g, '').substring(0, 30);
  const cleanAuthor = author.replace(/[<>]/g, '').substring(0, 30);
  
  // Generate a consistent background color based on title and author
  const bgColor = getRandomPastelColor(`${title}-${author}`);
  
  // Generate SVG
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
    <rect width="200" height="300" fill="${bgColor}" />
    <rect width="180" height="280" x="10" y="10" fill="white" fill-opacity="0.8" rx="5" />
    <text x="100" y="30" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#333">Book Cover</text>
    <text x="100" y="150" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#333">${cleanTitle}</text>
    <text x="100" y="180" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#555">${cleanAuthor}</text>
  </svg>`;
}

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
  const title = searchParams.get('title') || 'Unknown Title';
  const author = searchParams.get('author') || 'Unknown Author';
  
  try {
    // Generate SVG placeholder
    const svg = generatePlaceholderSVG(title, author);
    
    // Return SVG with appropriate headers
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
      }
    });
  } catch (error) {
    console.error('Error generating placeholder:', error);
    return NextResponse.json(
      { error: 'Failed to generate placeholder' },
      { status: 500 }
    );
  }
} 