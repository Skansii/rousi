"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Book } from "@/types/book";
import { Download, FileType, Globe, BookOpen } from "lucide-react";
import { BookCover } from "@/components/BookCover";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(book.cover_image || null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!book.cover_image);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  
  // Format month from number to name
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = book.month && book.month > 0 && book.month <= 12 
    ? monthNames[book.month - 1] 
    : '';
  
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

  useEffect(() => {
    if (!book.cover_image && !imageError && retryCount < MAX_RETRIES) {
      const fetchCoverImage = async () => {
        try {
          setIsLoading(true);
          // Add a slight delay to avoid hitting rate limits too quickly
          await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
          
          const response = await fetch(`/api/book-cover?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.coverImage) {
              setImageUrl(data.coverImage);
              setImageError(false);
            } else {
              setImageError(true);
            }
          } else {
            setImageError(true);
            if (response.status === 429) {
              console.log(`Rate limit hit for ${book.title}, waiting longer before retry`);
              // On rate limit, wait longer before retrying
              await new Promise(resolve => setTimeout(resolve, 5000));
              setRetryCount(prev => prev + 1);
            }
          }
        } catch (error) {
          console.error('Error fetching book cover:', error);
          setImageError(true);
        } finally {
          setIsLoading(false);
        }
      };

      fetchCoverImage();
    }
  }, [book.title, book.author, book.cover_image, imageError, retryCount]);

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

  return (
    <div className="flex flex-col overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl bg-white dark:bg-gray-800 h-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={book.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-opacity"
            onError={() => setImageError(true)}
            priority={false}
          />
        ) : (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
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
        )}
      </div>

      <div className="flex flex-col flex-grow p-4">
        <h3 className="mb-1 font-semibold leading-tight text-gray-900 dark:text-white">
          {shortTitle}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{book.author}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {book.format}
          </span>
          
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Download className="mr-1 h-4 w-4" />
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