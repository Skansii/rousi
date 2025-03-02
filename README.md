# Rousi Book Club

A web application for book enthusiasts, featuring:
- Monthly book recommendations
- Book collections with search and filters
- User authentication
- Digital book downloads

## Features

- User authentication using Clerk
- Monthly book propositions 
- Book details with descriptions scraped from the web
- Download links for each book
- Dark/Light theme toggle
- Responsive design
- MySQL database integration
- Filter books by language and format
- Search functionality
- Random book selection
- Large book collection management

## Tech Stack

- Next.js 15
- TypeScript
- Clerk for authentication
- MySQL for database
- Puppeteer for web scraping
- Tailwind CSS for styling
- Next Themes for theme management
- Lucide React for icons
- Vercel for deployment

## Prerequisites

- Node.js 18+ and npm
- MySQL database access
- Clerk account (for authentication)

## Getting Started

### Environment Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd rousi_app
```

2. Install the dependencies:

```bash
npm install
```

3. Create a `.env.local` file with the following environment variables:

```
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# MySQL Database
MYSQL_HOST=your-mysql-host
MYSQL_DATABASE=your-database-name
MYSQL_USER=your-mysql-username
MYSQL_PASSWORD=your-mysql-password

# Book API (for scraping book information)
NEXT_PUBLIC_API_URL=/api

# Deployment URL (for local development)
NEXT_PUBLIC_URL=http://localhost:3000

# Book Storage Path (for the download API)
BOOK_STORAGE_PATH=/path/to/your/books
```

### Database Setup

1. Access your MySQL database 
2. Run the SQL script in `db/schema.sql` to set up the database tables

### Importing Book Collection

The application includes a script for importing books from your local storage:

```bash
# Navigate to your project directory
cd rousi_app

# Run the import script
node scripts/import-books.js /path/to/your/books
```

The script will:
1. Scan the specified directory recursively
2. Extract book metadata (title, author, format, language, size)
3. Import the books into your database
4. Skip existing books to avoid duplicates

### Running the Application

1. Start the development server:

```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Dashboard Features

The dashboard has been enhanced with the following features:

### Filter Panel

- The left sidebar displays the Sadiki logo at the top
- Filter books by language (automatically detected from your collection)
- Filter books by format (PDF, EPUB, etc.)
- Search for books by title or author
- Mobile-responsive design with collapsible filter panel

### Book Display

Book cards now show:
- Book cover (or automatically generated placeholder)
- Title and author
- Language and format badges
- File size information
- Publication month and year (if available)
- Description with expandable text
- Download button linked to secure download API

### Random Book Selection

The dashboard displays a random selection of books, which changes when:
- The page is refreshed
- The "Refresh Books" button is clicked
- Filters are changed

### Pagination

- Navigate through large collections with pagination controls
- Configurable items per page

## API Routes

- `GET /api/books` - Get books with optional filtering and random selection
- `POST /api/books/add` - Add a new book to the database
- `POST /api/scrape` - Scrape book descriptions from the web
- `GET /api/download` - Securely download books (requires authentication)
- `GET /api/placeholder` - Generate placeholder book covers

## Deployment

The application is configured for deployment on Vercel:

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Set the environment variables in the Vercel dashboard
4. Deploy the application

## Project Structure

- `/src/app` - Next.js app router pages and API routes
- `/src/components` - Reusable UI components
- `/src/lib` - Utility functions and database connections
- `/src/types` - TypeScript type definitions
- `/public` - Static assets including the Sadiki logo
- `/db` - Database schema and scripts
- `/scripts` - Utility scripts like the book importer

## License

MIT
