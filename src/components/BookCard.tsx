"use client";

import Image from "next/image";
import { Book } from "@/types/book";
import { useState, useEffect } from "react";
import { Download, FileType, Globe, BookOpen } from "lucide-react";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isLoadingCover, setIsLoadingCover] = useState(true);
  const [coverError, setCoverError] = useState(false);
  
  // Format month from number to name
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = book.month && book.month > 0 && book.month <= 12 
    ? monthNames[book.month - 1] 
    : '';
  
  // Fetch book cover from external API if not provided
  useEffect(() => {
    const fetchCover = async () => {
      try {
        setIsLoadingCover(true);
        
        // Use provided cover if available
        if (book.cover_image) {
          setCoverImage(book.cover_image);
          return;
        }
        
        // Try to fetch from our book cover API
        const response = await fetch(
          `/api/book-cover?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.coverUrl) {
            setCoverImage(data.coverUrl);
            return;
          }
        }
        
        // Fall back to placeholder
        setCoverImage(
          `/api/placeholder?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`
        );
      } catch (error) {
        console.error("Error fetching book cover:", error);
        setCoverImage(
          `/api/placeholder?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`
        );
      } finally {
        setIsLoadingCover(false);
      }
    };
    
    fetchCover();
  }, [book.title, book.author, book.cover_image]);
  
  // Truncate description for initial display
  const truncateDescription = (text: string, maxLength: number) => {
    if (!text) return "No description available.";
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };
  
  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            <div className="relative w-48 h-72 mx-auto md:mx-0 bg-gray-100 dark:bg-gray-700 rounded-md shadow-md overflow-hidden">
              {isLoadingCover ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : coverImage ? (
                <Image
                  src={coverImage}
                  alt={book.title}
                  fill
                  className="object-cover"
                  onError={() => {
                    console.info("Cover image not available, using placeholder for:", book.title);
                    setCoverError(true);
                    
                    // Only try placeholder if we're not already using it
                    if (!coverImage.includes('/api/placeholder')) {
                      setCoverImage(`/api/placeholder?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`);
                      setCoverError(false);
                    }
                  }}
                  unoptimized={coverImage.startsWith('https://')}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                  <BookOpen size={48} className="text-gray-400" />
                </div>
              )}
              
              {coverError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                  <div className="p-4 text-center">
                    <BookOpen size={32} className="mx-auto mb-2 text-gray-500" />
                    <p className="text-xs text-gray-500">Cover not available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {book.title}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                  {book.author}
                </p>
              </div>
              {book.month && book.year && (
                <div className="text-sm font-medium py-1 px-3 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  {monthName} {book.year}
                </div>
              )}
            </div>
            
            {/* File details */}
            <div className="mt-4 flex flex-wrap gap-3">
              {book.language && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs">
                  <Globe size={14} className="text-gray-500 dark:text-gray-400" />
                  <span>{book.language}</span>
                </div>
              )}
              
              {book.format && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs">
                  <FileType size={14} className="text-gray-500 dark:text-gray-400" />
                  <span>{book.format.toUpperCase()}</span>
                </div>
              )}
              
              {book.file_size && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs">
                  <span>{formatFileSize(book.file_size)}</span>
                </div>
              )}
              
              {/* Always show downloads, default to 0 if not available */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs">
                <Download size={14} className="text-gray-500 dark:text-gray-400" />
                <span>{book.downloads || 0} {book.downloads === 1 ? 'download' : 'downloads'}</span>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="text-gray-700 dark:text-gray-300">
                {isExpanded 
                  ? (book.description || "No description available.") 
                  : truncateDescription(book.description, 250)}
              </div>
              
              {book.description && book.description.length > 250 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
            
            <div className="mt-6">
              {book.id && (
                <a
                  href={`/api/download?id=${book.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} />
                  Download Book
                </a>
              )}
              
              {book.download_link && !book.id && (
                <a
                  href={book.download_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} />
                  Download Book
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 