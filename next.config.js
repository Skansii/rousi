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
      'books-express.aabooks.co', // For Google Books API (alternative)
      'storage.googleapis.com', // For Google Books API (storage)
      'loremflickr.com', // For fallback book covers
    ],
    // Enable image optimization even for remote images
    unoptimized: process.env.NODE_ENV === 'development',
  },
  env: {
    GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 