/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'upload.wikimedia.org',  // For sample book covers
      'covers.openlibrary.org', // For Open Library book covers
      'images-na.ssl-images-amazon.com', // For Amazon book covers
      'i.gr-assets.com', // For Goodreads book covers
      'books.google.com', // For Google Books API
      'lh3.googleusercontent.com', // For Google Books API (alternative)
    ],
    // Enable image optimization even for remote images
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

module.exports = nextConfig; 