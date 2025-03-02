import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import path from 'path';
import { addDownloadsColumn } from '../../../../../scripts';

// For added security, we require both authentication and an admin secret
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'replace_this_with_secure_secret';
// Rate limiting - simple in-memory implementation
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS = 5;
const requestLog: { [ip: string]: number[] } = {};

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Implement basic rate limiting
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests', message: 'Please try again later' },
        { status: 429 }
      );
    }
    
    // Verify clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify admin secret from request body
    const body = await request.json();
    if (body.adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Invalid admin secret' }, { status: 403 });
    }
    
    // Record the attempt for rate limiting
    recordRequest(ip);
    
    // Run the database update
    console.log('Starting database schema update...');
    const success = await addDownloadsColumn();
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Database update encountered issues',
        message: 'Check server logs for details'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating database schema:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update database schema', 
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Rate limiting helper functions
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recentRequests = (requestLog[ip] || []).filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
  
  return recentRequests.length >= MAX_REQUESTS;
}

function recordRequest(ip: string): void {
  const now = Date.now();
  requestLog[ip] = [...(requestLog[ip] || []), now].filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
} 