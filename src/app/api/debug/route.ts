import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // For security, only return limited info
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL ? 'true' : 'false',
      VERCEL_URL: process.env.VERCEL_URL ? 'set' : 'not set',
      NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL ? 'set' : 'not set',
      MYSQL_HOST: process.env.MYSQL_HOST ? 'set' : 'not set',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE ? 'set' : 'not set',
      MYSQL_USER: process.env.MYSQL_USER ? 'set' : 'not set',
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? 'set' : 'not set',
      GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY ? 'set' : 'not set',
    };
    
    // Test database connection
    let dbStatus = 'unknown';
    try {
      const connection = await getConnection();
      await connection.end();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = `error: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
    
    return NextResponse.json({
      environment: envInfo,
      database: dbStatus,
      request: {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Debug endpoint error' }, { status: 500 });
  }
} 