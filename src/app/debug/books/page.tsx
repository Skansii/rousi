/**
 * This page is for debugging purposes only.
 * It directly displays books from the database without trying to load thumbnails.
 */

import { getConnection } from '@/lib/db';
import { formatDistance } from 'date-fns';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Book extends RowDataPacket {
  id: number;
  title: string;
  author: string;
  format: string;
  language: string;
  downloads: number;
  created_at: string;
  updated_at: string;
}

export default async function DebugBooksPage() {
  const books = await getBooks();
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug: Books in Database</h1>
      <p className="mb-4">This page bypasses authentication and directly queries the database.</p>
      <p className="mb-2">Total books found: <strong>{books.length}</strong></p>
      
      <div className="overflow-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border">ID</th>
              <th className="py-2 px-4 border">Title</th>
              <th className="py-2 px-4 border">Author</th>
              <th className="py-2 px-4 border">Format</th>
              <th className="py-2 px-4 border">Language</th>
              <th className="py-2 px-4 border">Downloads</th>
              <th className="py-2 px-4 border">Created</th>
            </tr>
          </thead>
          <tbody>
            {books.length > 0 ? (
              books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">{book.id}</td>
                  <td className="py-2 px-4 border font-medium">{book.title}</td>
                  <td className="py-2 px-4 border">{book.author}</td>
                  <td className="py-2 px-4 border">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {book.format}
                    </span>
                  </td>
                  <td className="py-2 px-4 border">{book.language}</td>
                  <td className="py-2 px-4 border">{book.downloads}</td>
                  <td className="py-2 px-4 border text-sm">
                    {formatDistance(new Date(book.created_at), new Date(), { addSuffix: true })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <ArrowPathIcon className="w-10 h-10 text-gray-400 mb-2" />
                    <p>No books found in the database</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
        <p>Page rendered at: {new Date().toISOString()}</p>
        <p>Database query executed directly without authentication checking</p>
      </div>
    </div>
  );
}

async function getBooks(): Promise<Book[]> {
  try {
    const connection = await getConnection();
    
    const [results] = await connection.execute<Book[]>(`
      SELECT id, title, author, format, language, downloads, created_at, updated_at
      FROM books
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    await connection.end();
    return results;
  } catch (error) {
    console.error('Error fetching books:', error);
    return [];
  }
} 