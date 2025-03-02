"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Search, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterSidebarProps {
  languages: FilterOption[];
  formats: FilterOption[];
  onFilterChange: (filters: {
    language?: string;
    format?: string;
    search?: string;
  }) => void;
  currentFilters: {
    language?: string;
    format?: string;
    search?: string;
  };
}

export function FilterSidebar({
  languages,
  formats,
  onFilterChange,
  currentFilters
}: FilterSidebarProps) {
  const [search, setSearch] = useState(currentFilters.search || '');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      ...currentFilters,
      search
    });
  };

  const handleLanguageChange = (language: string | undefined) => {
    onFilterChange({
      ...currentFilters,
      language
    });
  };

  const handleFormatChange = (format: string | undefined) => {
    onFilterChange({
      ...currentFilters,
      format
    });
  };

  const toggleMobileFilters = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile filter toggle button */}
      <button 
        className="md:hidden fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-50"
        onClick={toggleMobileFilters}
      >
        {isMobileOpen ? <X /> : <Search />}
      </button>
      
      {/* Sidebar */}
      <aside className={`
        bg-white dark:bg-gray-800 w-64 flex-shrink-0 border-r dark:border-gray-700
        ${isMobileOpen ? 'fixed inset-y-0 left-0 z-40 transform translate-x-0' : 'hidden md:block'}
        md:relative md:transform-none transition-transform duration-200 ease-in-out
      `}>
        <div className="h-full flex flex-col overflow-y-auto">
          {/* Logo */}
          <div className="p-4 border-b dark:border-gray-700">
            <div className="flex flex-col items-center">
              <Image 
                src="/sadiki_logo.png" 
                alt="Sadiki Logo" 
                width={200}
                height={80} 
                className="mb-2 rounded p-2 border border-gray-200 dark:border-gray-700"
                priority
                onError={(e) => {
                  console.error('Error loading logo');
                  // Fallback to text if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.style.display = 'none';
                }}
              />
            </div>
          </div>
          
          {/* Filters */}
          <div className="p-4 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h2>
            
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button 
                  type="submit"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400"
                >
                  <Search size={18} />
                </button>
              </div>
            </form>
            
            {/* Language Filter */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Language</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="language-all"
                    name="language"
                    checked={!currentFilters.language}
                    onChange={() => handleLanguageChange(undefined)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="language-all" className="ml-2 text-gray-700 dark:text-gray-300">
                    All Languages
                  </label>
                </div>
                
                {languages && languages.length > 0 ? (
                  languages.map((language) => (
                    <div key={language.value} className="flex items-center">
                      <input
                        type="radio"
                        id={`language-${language.value}`}
                        name="language"
                        checked={currentFilters.language === language.value}
                        onChange={() => handleLanguageChange(language.value)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`language-${language.value}`} className="ml-2 text-gray-700 dark:text-gray-300">
                        {language.label} {language.count && `(${language.count})`}
                      </label>
                    </div>
                  ))
                ) : (
                  // Fallback options if no languages are returned from API
                  ['Arabic', 'English', 'German'].map((lang) => (
                    <div key={lang} className="flex items-center">
                      <input
                        type="radio"
                        id={`language-${lang}`}
                        name="language"
                        checked={currentFilters.language === lang}
                        onChange={() => handleLanguageChange(lang)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`language-${lang}`} className="ml-2 text-gray-700 dark:text-gray-300">
                        {lang}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Format Filter */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Format</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="format-all"
                    name="format"
                    checked={!currentFilters.format}
                    onChange={() => handleFormatChange(undefined)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="format-all" className="ml-2 text-gray-700 dark:text-gray-300">
                    All Formats
                  </label>
                </div>
                
                {formats && formats.length > 0 ? (
                  formats.map((format) => (
                    <div key={format.value} className="flex items-center">
                      <input
                        type="radio"
                        id={`format-${format.value}`}
                        name="format"
                        checked={currentFilters.format === format.value}
                        onChange={() => handleFormatChange(format.value)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`format-${format.value}`} className="ml-2 text-gray-700 dark:text-gray-300">
                        {format.label} {format.count && `(${format.count})`}
                      </label>
                    </div>
                  ))
                ) : (
                  // Fallback options if no formats are returned from API
                  ['PDF', 'EPUB'].map((fmt) => (
                    <div key={fmt.toLowerCase()} className="flex items-center">
                      <input
                        type="radio"
                        id={`format-${fmt.toLowerCase()}`}
                        name="format"
                        checked={currentFilters.format === fmt.toLowerCase()}
                        onChange={() => handleFormatChange(fmt.toLowerCase())}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`format-${fmt.toLowerCase()}`} className="ml-2 text-gray-700 dark:text-gray-300">
                        {fmt}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}