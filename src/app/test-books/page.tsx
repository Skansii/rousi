"use client";

import { useEffect, useState } from 'react';
import { Book } from '@/types/book';

export default function TestBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbResponse, setDbResponse] = useState<{
    success?: boolean;
    error?: string;
    message?: string;
    books?: Book[];
    total?: number;
  } | null>(null);

  useEffect(() => {
    async function fetchBooks() {
      try {
        setLoading(true);
        // Simple fetch with random=true to get a basic set of books
        const response = await fetch('/api/books?random=true&page=1&limit=20');
        const responseData = await response.json();
        
        // Store the full response for debugging
        setDbResponse(responseData);
        
        if (response.ok) {
          setBooks(responseData.books || []);
        } else {
          setError(`Error ${response.status}: ${responseData.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Failed to fetch books:', err);
        setError('Failed to load books. Check console for details.');
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Database Test - Books Only</h1>
      
      {loading && <p className="text-blue-600">Loading books from database...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Diagnostic info */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Diagnostic Info:</h2>
        <p>Books loaded: {books.length}</p>
        {dbResponse && (
          <details className="mt-2 p-2 border rounded">
            <summary className="cursor-pointer font-medium">Full API Response (click to expand)</summary>
            <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(dbResponse, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {books.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Books in Database:</h2>
          <ul className="divide-y">
            {books.map((book: Book) => (
              <li key={book.id} className="py-4">
                <h3 className="text-lg font-medium">{book.title}</h3>
                <p className="text-gray-600">Author: {book.author}</p>
                <p className="text-gray-500">Format: {book.format || 'Unknown'}</p>
                <p className="text-gray-500">Language: {book.language || 'Unknown'}</p>
                <p className="text-gray-500">ID: {book.id}</p>
                <p className="text-gray-500">File Path: {book.file_path || 'Not specified'}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : !loading && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>No books found in the database.</p>
        </div>
      )}
    </div>
  );
} 