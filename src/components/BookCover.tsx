"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";

interface BookCoverProps {
  title: string;
  author: string;
  coverImage?: string | null;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

export function BookCover({
  title,
  author,
  coverImage,
  width = 200,
  height = 300,
  priority = false,
  className = "",
}: BookCoverProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(coverImage || null);

  useEffect(() => {
    const fetchCover = async () => {
      if (coverImage) {
        setImageUrl(coverImage);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          `/api/book-cover?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.coverUrl) {
            setImageUrl(data.coverUrl);
            return;
          }
        }

        // Fall back to placeholder if API failed
        setImageUrl(
          `/api/placeholder?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
        );
      } catch (err) {
        console.error("Error fetching book cover:", err);
        setError(true);
        setImageUrl(
          `/api/placeholder?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCover();
  }, [title, author, coverImage]);

  return (
    <div 
      className={`relative ${className}`} 
      style={{ width, height }}
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded animate-pulse">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover rounded"
          unoptimized={!!imageUrl && imageUrl.startsWith('https://')}
          priority={priority}
          onError={() => {
            console.log("Image failed to load:", imageUrl);
            setError(true);
            // Fall back to placeholder if not already using one
            if (!imageUrl.includes('/api/placeholder')) {
              setImageUrl(`/api/placeholder?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);
            }
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded">
          <BookOpen size={width / 4} className="text-gray-400" />
          <p className="absolute bottom-2 text-xs text-center text-gray-500 px-2">
            {title}
          </p>
        </div>
      )}

      {error && !imageUrl?.includes('/api/placeholder') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200/90 dark:bg-gray-800/90 rounded">
          <BookOpen size={width / 4} className="text-gray-500 mb-2" />
          <p className="text-xs text-center text-gray-600 dark:text-gray-400 px-2">
            Cover not available
          </p>
        </div>
      )}
    </div>
  );
} 