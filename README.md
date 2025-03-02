# Rousi Book Club

A modern web application for managing and sharing books within your community or organization.

## Features

- User authentication via Clerk
- Book catalog with search and filtering
- Book cover images fetched from Google Books and Open Library APIs
- Book downloading with tracking
- Mobile-responsive design with dark mode support

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MySQL database
- Clerk account for authentication

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rousi-book-club.git
cd rousi-book-club
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with the following variables:
```
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# MySQL Database
DATABASE_HOST=localhost
DATABASE_USER=rousi
DATABASE_PASSWORD=password
DATABASE_NAME=rousi_books

# Google Books API
GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Deployment URL
NEXT_PUBLIC_URL=http://localhost:3000
```

4. Initialize the database:
```bash
# Run the database schema update
npm run db:update
```

5. Start the development server:
```bash
npm run dev
```

### Setting up Google Books API

To fetch book covers and information from Google Books API:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to "APIs & Services" > "Library"
4. Search for "Books API" and enable it
5. Go to "APIs & Services" > "Credentials"
6. Create an API key
7. Add the API key to your `.env.local` file as `GOOGLE_BOOKS_API_KEY`

You can test your Google Books API key setup with:
```bash
node scripts/test-google-books.js
```

## Database Schema Management

The application includes tools to manage and update the database schema:

### Local Database Updates

To update your local database schema:
```bash
npm run db:update
```

### Remote/Production Database Updates

To update a remote/production database:
```bash
# For production environment
npm run db:update:remote production

# For preview/staging environment
npm run db:update:remote preview

# For custom URL
npm run db:update:remote custom
```

The script will prompt for any required information that's not available in environment variables.

### Adding New Database Migrations

1. Create a new script in the `scripts` directory for your migration
2. Export it in `scripts/index.js`
3. Create a new API endpoint or update the existing one to use your migration

## Deployment

### Vercel Deployment

1. Push your project to GitHub
2. Create a new project in Vercel
3. Configure environment variables in Vercel
4. Deploy the application
5. Update the database schema:
   ```bash
   npm run db:update:remote production
   ```

## Error Handling and Debugging

The application includes robust error handling mechanisms:

- API routes return proper error status codes and messages
- Client components include retry logic for external API calls
- Database operations are wrapped in try/catch blocks

To debug issues:
1. Check the browser console for client-side errors
2. Check Vercel logs for server-side errors
3. Enable verbose logging by setting `DEBUG=true` in environment variables

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Components

### BookCover Component

The application includes a reusable `BookCover` component for displaying book covers:

```tsx
<BookCover 
  title="Book Title"
  author="Author Name"
  coverImage={coverImageUrl}
  width={192}
  height={288}
  priority={true}
  className="rounded-md"
/>
```

This component handles:
- Loading states with a spinner
- Error states with a fallback UI
- Automatic fetching from the book cover API if no image URL is provided
- Optimized image loading
