import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Book type definition
interface Book {
  id: number;
  title: string;
  author: string;
  format: string;
  language: string;
  cover_image?: string;
  downloads: number;
  file_size?: number;
  month?: number;
  year?: number;
}

// Function to fetch books from API
async function fetchBooks(options: {
  page: number;
  limit: number;
  search?: string;
  format?: string;
  language?: string;
  random?: boolean;
}): Promise<{ books: Book[]; total: number }> {
  const params = new URLSearchParams();
  if (options.search) params.append('search', options.search);
  if (options.format) params.append('format', options.format);
  if (options.language) params.append('language', options.language);
  if (options.random) params.append('random', 'true');
  params.append('page', options.page.toString());
  params.append('limit', options.limit.toString());
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/books?${params.toString()}`, { cache: 'no-store' });
  
  if (!response.ok) {
    throw new Error('Failed to fetch books');
  }
  
  const data = await response.json();
  return {
    books: data.books || [],
    total: data.total || 0
  };
}

// Simple BookCard component
function BookCard({ book }: { book: Book }) {
  // Create an acronym for the book title to display as a fallback
  const getInitials = (text: string) => {
    return text
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
  };
  
  // Generate a pastel background color based on the book title
  const generateColor = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 80%)`;
  };

  const bookInitials = getInitials(book.title);
  const fallbackBgColor = generateColor(book.title);
  const shortTitle = book.title.length > 60 ? `${book.title.substring(0, 57)}...` : book.title;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl bg-white dark:bg-gray-800 h-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        {book.cover_image ? (
          <Image
            src={book.cover_image}
            alt={book.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-opacity"
            onError={(e) => {
              // On error, hide the image and show fallback
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.classList.add('fallback-active');
            }}
          />
        ) : null}
        
        <div 
          className={`absolute inset-0 flex flex-col items-center justify-center p-4 text-center ${book.cover_image ? 'hidden fallback' : ''}`}
          style={{ backgroundColor: fallbackBgColor }}
        >
          <BookOpen className="h-12 w-12 text-gray-700 mb-2" />
          <div className="text-3xl font-bold text-gray-700">
            {bookInitials}
          </div>
          <div className="text-sm text-gray-700 mt-2 font-semibold">
            {book.format?.toUpperCase() || 'PDF'}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-grow p-4">
        <h3 className="mb-1 font-semibold leading-tight text-gray-900 dark:text-white">
          {shortTitle}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{book.author}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {book.format?.toUpperCase() || 'PDF'}
          </span>
          
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <span>{book.downloads || 0}</span>
          </div>
        </div>

        <Link 
          href={`/api/download?id=${book.id}`} 
          className="mt-4 flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Download
        </Link>
      </div>
    </div>
  );
}

// Simple pagination component
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

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Parse search parameters
  const page = searchParams.page ? parseInt(searchParams.page as string) : 1;
  const limit = searchParams.limit ? parseInt(searchParams.limit as string) : 12;
  const search = searchParams.search as string | undefined;
  const format = searchParams.format as string | undefined;
  const language = searchParams.language as string | undefined;
  const random = searchParams.random ? (searchParams.random === 'true') : true;

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
        <h1 className="text-3xl font-bold">Book Library</h1>
        
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
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          
          <div className="mt-8">
            <Pagination currentPage={page} totalPages={totalPages} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="h-16 w-16 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            No books found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            {search
              ? `No books matching "${search}" were found. Try adjusting your search or filters.`
              : "No books available with the current filters. Try changing your search criteria."}
          </p>
        </div>
      )}
    </div>
  );
} 