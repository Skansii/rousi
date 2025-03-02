import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Dev mode: bypass authentication
    let userId;
    try {
      const { userId: authUserId } = await auth();
      userId = authUserId;
    } catch (_error) {
      // Using dev-user for local development
      userId = 'dev-user';
    }

    // If no user ID is found, and we're not in dev mode with a dev-user, return unauthorized
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');
    const format = searchParams.get('format');
    const search = searchParams.get('search');
    const random = searchParams.get('random') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Base query
    let query = `
      SELECT 
        id, title, author, description, cover_image, 
        download_link, format, language, file_size, 
        month, year, created_at, updated_at,
        0 as downloads
      FROM books 
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    // Add filters
    if (language) {
      query += ` AND language = ?`;
      queryParams.push(language);
    }
    
    if (format) {
      query += ` AND format = ?`;
      queryParams.push(format);
    }
    
    if (search) {
      query += ` AND (title LIKE ? OR author LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // Add order by, either random or most recent
    if (random) {
      query += ` ORDER BY RAND()`;
    } else {
      query += ` ORDER BY year DESC, month DESC`;
    }
    
    // Add limit
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // Execute query
    const books = await executeQuery(query, queryParams);
    
    // Get available languages and formats for filters
    const [languages] = await executeQuery(
      `SELECT DISTINCT language FROM books ORDER BY language`
    ) as [any[]];
    
    const [formats] = await executeQuery(
      `SELECT DISTINCT format FROM books ORDER BY format`
    ) as [any[]];
    
    // Get total count for pagination
    const [countResult] = await executeQuery(
      `SELECT COUNT(*) as total FROM books`,
      []
    ) as any[];
    
    const total = countResult?.total || 0;
    
    // Ensure Arabic, English and German are always included in language filters
    // Convert the query result to a simple array of language objects
    const availableLanguages = Array.isArray(languages) 
      ? languages.map((row) => ({ language: row.language })) 
      : [];
    
    // Add required languages if they're not present in database
    const requiredLanguages = ['Arabic', 'English', 'German'];
    const existingLanguageNames = availableLanguages.map((item) => item.language);
    
    for (const lang of requiredLanguages) {
      if (!existingLanguageNames.includes(lang)) {
        availableLanguages.push({ language: lang });
      }
    }
    
    return NextResponse.json({
      books,
      filters: {
        languages: availableLanguages,
        formats: Array.isArray(formats) ? formats : []
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    );
  }
} 