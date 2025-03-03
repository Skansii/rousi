import { Suspense as _Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import { BookCard } from '@/components/BookCard';
import { Book } from '@/types/book';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Define proper PageProps interface with searchParams
type SearchParams = {
  page?: string;
  limit?: string;
  search?: string;
  format?: string;
  language?: string;
  random?: string;
};

interface PageProps {
  params: { slug?: string };
  searchParams: SearchParams;
}

// Pagination component
function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  return (
    <div className="flex items-center justify-center space-x-2">
      <Link
        href={`/dashboard?page=${Math.max(1, currentPage - 1)}`}
        className={`inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 dark:border-gray-600 ${
          currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : undefined}
      >
        Previous
      </Link>
      
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
        Page {currentPage} of {totalPages}
      </span>
      
      <Link
        href={`/dashboard?page=${Math.min(totalPages, currentPage + 1)}`}
        className={`inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 dark:border-gray-600 ${
          currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : undefined}
      >
        Next
      </Link>
    </div>
  );
}

export default async function Dashboard({ searchParams }: PageProps) {
  const { userId } = await auth();
   
  if (!userId) {
    redirect('/sign-in');
  }

  // Parse search parameters (properly handled for Next.js 15)
  const page = searchParams?.page ? parseInt(searchParams.page) : 1;
  const limit = searchParams?.limit ? parseInt(searchParams.limit) : 12;
  const search = searchParams?.search || '';
  const format = searchParams?.format || '';
  const language = searchParams?.language || '';
  // Fix the random parameter - only set to true if explicitly specified
  const random = searchParams?.random === 'true';

  // Fetch books function
  async function fetchBooks(params: {
    page?: number;
    limit?: number;
    search?: string;
    format?: string;
    language?: string;
    random?: boolean;
  }) {
    const { page, limit, search, format, language, random } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());
    if (search) queryParams.append('search', search);
    if (format) queryParams.append('format', format);
    if (language) queryParams.append('language', language);
    if (random) queryParams.append('random', 'true');
    
    console.log('Fetching books with params:', queryParams.toString());
    
    try {
      // Get the base URL dynamically
      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3002' 
          : '';
      
      // Make sure we have a baseUrl
      if (!baseUrl) {
        throw new Error('Base URL not configured. Set NEXT_PUBLIC_VERCEL_URL environment variable.');
      }
      
      // Using this approach because we're in a server component
      const response = await fetch(new URL(`/api/books?${queryParams.toString()}`, baseUrl), {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch books: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Books fetched successfully:', data.books?.length || 0, 'books');
      return data;
    } catch (error) {
      console.error('Error fetching books:', error);
      return { books: [], total: 0 };
    }
  }

  // Fetch books based on search parameters
  const { books, total } = await fetchBooks({
    page,
    limit,
    search,
    format,
    language,
    random,
  });

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center">
          <div className="relative w-auto h-auto">
            <Image 
              src="/sadiki_logo.png" 
              alt="Sadiki Logo" 
              width={240} 
              height={120} 
              className="object-contain"
              priority
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <form action="/dashboard" method="GET" className="flex space-x-2">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search books..."
              className="rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
            />
            
            <select
              name="format"
              defaultValue={format}
              className="rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Formats</option>
              <option value="pdf">PDF</option>
              <option value="epub">EPUB</option>
            </select>
            
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {books.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {books.map((book: Book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">No books found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Try adjusting your search or filter to find what you&apos;re looking for.
          </p>
        </div>
      )}
    </div>
  );
} 