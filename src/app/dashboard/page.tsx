"use client";

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { BookCard } from '@/components/BookCard';
import { FilterSidebar } from '@/components/FilterSidebar';
import { Book } from '@/types/book';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    language: undefined as string | undefined,
    format: undefined as string | undefined,
    search: undefined as string | undefined,
  });
  const [languages, setLanguages] = useState<{value: string, label: string, count?: number}[]>([]);
  const [formats, setFormats] = useState<{value: string, label: string, count?: number}[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const fetchBooks = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.language) params.append('language', filters.language);
      if (filters.format) params.append('format', filters.format);
      if (filters.search) params.append('search', filters.search);
      params.append('random', 'true'); // Always fetch random books
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      const response = await fetch(`/api/books?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch books');
      }
      
      const data = await response.json();
      setBooks(data.books || []);
      
      // Process filter options
      if (data.filters) {
        const languageOptions = data.filters.languages.map((lang: any) => ({
          value: lang.language,
          label: lang.language
        }));
        
        const formatOptions = data.filters.formats.map((fmt: any) => ({
          value: fmt.format,
          label: fmt.format === 'pdf' ? 'PDF' : fmt.format.toUpperCase()
        }));
        
        setLanguages(languageOptions);
        setFormats(formatOptions);
      }
      
      // Update pagination info
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      setError('Failed to load books. Please try again later.');
      
      // Even on error, make sure we have some default filter options
      if (languages.length === 0) {
        setLanguages([
          { value: 'Arabic', label: 'Arabic' },
          { value: 'English', label: 'English' },
          { value: 'German', label: 'German' }
        ]);
      }
      
      if (formats.length === 0) {
        setFormats([
          { value: 'pdf', label: 'PDF' },
          { value: 'epub', label: 'EPUB' }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [filters, pagination.page]);

  const handleFilterChange = (newFilters: {
    language?: string;
    format?: string;
    search?: string;
  }) => {
    setFilters({
      language: newFilters.language,
      format: newFilters.format,
      search: newFilters.search
    });
    // Reset to page 1 when filters change
    setPagination(prev => ({...prev, page: 1}));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex flex-col md:flex-row">
        <div className="md:block">
          <FilterSidebar 
            languages={languages} 
            formats={formats} 
            onFilterChange={handleFilterChange}
            currentFilters={filters}
          />
        </div>
        
        <main className="flex-1 px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Book Collection
                </h1>
                {pagination.total > 0 && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {pagination.total} books in database
                  </p>
                )}
              </div>
              <button 
                onClick={() => fetchBooks()} 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh Books
              </button>
            </div>
            
            {loading ? (
              <div className="flex flex-col justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading your book collection...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            ) : books.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <p className="text-yellow-700 dark:text-yellow-400">
                  No books found with the current filters. Try adjusting your search criteria.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
            
            {/* Simple pagination controls */}
            {!loading && books.length > 0 && pagination.totalPages > 1 && (
              <div className="mt-8 flex justify-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({...prev, page: Math.max(1, prev.page - 1)}))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({...prev, page: Math.min(prev.totalPages, prev.page + 1)}))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}