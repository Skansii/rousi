"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Book } from "@/types/book";
import { Download, FileType as _FileType, Globe as _Globe, BookOpen } from "lucide-react";
import { BookCover as _BookCover } from "@/components/BookCover";

// Create an ImageWithFallback client component to handle the onError event
function ImageWithFallback({
  src,
  alt,
  fallback,
  priority,
  ...props
}: {
  src: string;
  alt: string;
  fallback: React.ReactNode;
  priority?: boolean;
  [key: string]: any;
}) {
  const [error, setError] = useState<boolean>(false);
  
  return error ? (
    <div className="image-fallback">{fallback}</div>
  ) : (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  );
}

// Add a shimmer loading effect component
function ShimmerEffect() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"></div>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
    </div>
  );
}

// Create a client component for fallback UI
const FallbackUI = ({ initials, format, bgColor }: { initials: string; format?: string; bgColor: string }) => (
  <div 
    className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
    style={{ backgroundColor: bgColor }}
  >
    <BookOpen className="h-12 w-12 text-gray-700 mb-2" />
    <div className="text-3xl font-bold text-gray-700">
      {initials}
    </div>
    <div className="text-sm text-gray-700 mt-2 font-semibold">
      {format?.toUpperCase() || 'PDF'}
    </div>
  </div>
);

// Create a component for the book cover image with proper error handling
const BookCoverImage = ({ 
  imageUrl, 
  title, 
  fallbackUI 
}: { 
  imageUrl: string; 
  title: string; 
  fallbackUI: React.ReactNode 
}) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <>{fallbackUI}</>;
  }
  
  return (
    <div className="relative w-full h-full">
      <Image
        src={imageUrl}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover transition-opacity"
        onError={() => setError(true)}
        priority={false}
      />
    </div>
  );
};

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(book.cover_image || null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!book.cover_image);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  
  // Format month from number to name
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  const _monthName = book.month && book.month > 0 && book.month <= 12 
    ? monthNames[book.month - 1] 
    : '';
  
  // Ensure we have a description or provide a default
  const bookDescription = book.description || 
    `${book.title} by ${book.author}. This book is available in ${book.format || 'digital'} format.` +
    (book.month && book.year ? ` Published in ${_monthName} ${book.year}.` : '');
  
  // Truncate description for initial display
  const truncateDescription = (text: string, maxLength: number) => {
    if (!text) return "No description available.";
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };
  
  // Format file size
  const _formatFileSize = (bytes?: number) => {
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

  // Helper function to get the base URL for API calls
  const getApiBaseUrl = () => {
    // Check if we're in the browser
    if (typeof window !== 'undefined') {
      // Use window.location to get the current origin
      return window.location.origin;
    }
    // Fallback for SSR
    return process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : 'http://localhost:3002';
  };

  useEffect(() => {
    if (!book.cover_image && !imageError && retryCount < MAX_RETRIES) {
      const fetchCoverImage = async () => {
        try {
          setIsLoading(true);
          // Add a slight delay to avoid hitting rate limits too quickly
          await new Promise(resolve => setTimeout(resolve, retryCount * 1500));
          
          const baseUrl = getApiBaseUrl();
          const encodedTitle = encodeURIComponent(book.title);
          const encodedAuthor = encodeURIComponent(book.author);
          const url = `${baseUrl}/api/book-cover?title=${encodedTitle}&author=${encodedAuthor}`;
          
          console.log(`Fetching cover image from: ${url}`);
          const response = await fetch(url, {
            // Add cache control headers
            headers: {
              'Cache-Control': 'max-age=604800'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            // Handle both coverImage and coverUrl formats
            if (data.coverImage || data.coverUrl) {
              setImageUrl(data.coverImage || data.coverUrl);
              setImageError(false);
            } else {
              // Use a more relevant fallback image if no cover found
              const categoryKeywords = getCategoryKeywords(book.title);
              const fallbackUrl = `https://loremflickr.com/320/480/${categoryKeywords}?lock=${Math.abs(hashString(book.title)) % 100}`;
              setImageUrl(fallbackUrl);
              setImageError(false);
            }
          } else {
            // Use category-specific fallback images on error
            const categoryKeywords = getCategoryKeywords(book.title);
            const fallbackUrl = `https://loremflickr.com/320/480/${categoryKeywords}?lock=${Math.abs(hashString(book.title)) % 100}`;
            setImageUrl(fallbackUrl);
            setImageError(false);
            
            console.error(`Error fetching cover image: ${response.status} ${response.statusText}`);
            if (response.status === 429) {
              console.log(`Rate limit hit for ${book.title}, waiting longer before retry`);
              // On rate limit, wait longer before retrying
              await new Promise(resolve => setTimeout(resolve, 5000 + (retryCount * 2000)));
              setRetryCount(prev => prev + 1);
            }
          }
        } catch (error) {
          console.error('Error fetching book cover:', error);
          // Use category-specific fallback images on error
          const categoryKeywords = getCategoryKeywords(book.title);
          const fallbackUrl = `https://loremflickr.com/320/480/${categoryKeywords}?lock=${Math.abs(hashString(book.title)) % 100}`;
          setImageUrl(fallbackUrl);
          setImageError(false);
        } finally {
          setIsLoading(false);
        }
      };

      fetchCoverImage();
    }
  }, [book.title, book.author, book.cover_image, imageError, retryCount]);

  // Simple string hash function used for generating consistent image IDs
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  };

  // Create a shortened version of the title for display
  const shortTitle = book.title.length > 60 ? `${book.title.substring(0, 57)}...` : book.title;
  
  // Create an acronym for the book title to display as a fallback
  const getInitials = (text: string) => {
    return text
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
  };

  const bookInitials = getInitials(book.title);
  
  // Generate a pastel background color based on the book title
  const generateColor = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 80%)`;
  };

  const fallbackBgColor = generateColor(book.title);

  // Create fallback UI component
  const fallbackUI = (
    <FallbackUI
      initials={bookInitials}
      format={book.format}
      bgColor={fallbackBgColor}
    />
  );

  // Function to determine category keywords for more relevant fallback images
  const getCategoryKeywords = (title: string) => {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('ai') || 
        titleLower.includes('machine learning') || 
        titleLower.includes('python') || 
        titleLower.includes('programming') ||
        titleLower.includes('development') ||
        titleLower.includes('software')) {
      return 'technology,book';
    } else if (titleLower.includes('novel') || 
               titleLower.includes('fiction') || 
               titleLower.includes('stories')) {
      return 'fiction,book';
    } else if (titleLower.includes('science') || 
               titleLower.includes('physics') || 
               titleLower.includes('chemistry') ||
               titleLower.includes('biology')) {
      return 'science,book';
    } else if (titleLower.includes('history') || 
               titleLower.includes('biography') || 
               titleLower.includes('memoir')) {
      return 'history,book';
    } else {
      return 'book,cover';
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl bg-white dark:bg-gray-800 h-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        {isLoading ? (
          <ShimmerEffect />
        ) : imageUrl && !imageError ? (
          <BookCoverImage
            imageUrl={imageUrl}
            title={book.title}
            fallbackUI={fallbackUI}
          />
        ) : (
          fallbackUI
        )}
      </div>

      <div className="flex flex-col flex-grow p-4">
        <h3 className="mb-1 font-semibold leading-tight text-gray-900 dark:text-white">
          {shortTitle}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{book.author}</p>
        
        <div className="mb-4">
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            {isExpanded 
              ? bookDescription 
              : truncateDescription(bookDescription, 150)}
          </div>
          
          {bookDescription && bookDescription.length > 150 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {book.format}
          </span>
          
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Download className="mr-1 h-4 w-4" />
            <span>{book.downloads || 0} {book.downloads === 1 ? 'download' : 'downloads'}</span>
          </div>
        </div>

        <Link 
          href={`${getApiBaseUrl()}/api/download?id=${book.id}`} 
          className="mt-4 flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Download
        </Link>
      </div>
    </div>
  );
} 