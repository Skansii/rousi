export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string;
  download_link: string;
  file_path?: string;
  format?: string;
  language?: string;
  file_size?: number;
  downloads?: number;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export type BookFilterParams = {
  language?: string;
  format?: string;
  search?: string;
  page?: number;
  limit?: number;
} 