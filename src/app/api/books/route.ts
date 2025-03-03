import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
    
    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');
    const format = url.searchParams.get('format');
    const language = url.searchParams.get('language');
    const random = url.searchParams.get('random') === 'true';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Prepare SQL query
    let whereConditions = [];
    let params: Array<string | number> = [];
    
    if (search) {
      whereConditions.push('(title LIKE ? OR author LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (format) {
      whereConditions.push('format = ?');
      params.push(format);
    }
    
    if (language) {
      whereConditions.push('language = ?');
      params.push(language);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Get total count first
    const countQuery = `SELECT COUNT(*) as total FROM books ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);
    
    // TypeScript type assertion for the database response
    const total = Array.isArray(countResult) && countResult.length > 0 
      ? (countResult[0] as { total: number }).total 
      : 0;
    
    // Construct and execute main query
    const orderBy = random ? 'ORDER BY RAND()' : 'ORDER BY id DESC';
    const query = `
      SELECT 
        id, title, author, format, language, 
        cover_image, downloads, file_size, 
        month, year
      FROM books 
      ${whereClause} 
      ${orderBy} 
      LIMIT ? OFFSET ?
    `;
    
    const books = await executeQuery(query, [...params, limit, offset]);
    
    return NextResponse.json({ books, total, page, limit });
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 