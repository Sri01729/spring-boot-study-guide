import Link from 'next/link';
import { getAllDocs } from '@/utils/docs';

export default async function Home() {
  const docs = getAllDocs();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <header className="py-20 text-center bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
            Master Spring Boot
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            Your comprehensive guide to building robust, production-ready applications with Spring Boot.
          </p>
        </div>
      </header>

      {/* Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {docs.map((doc) => {
            const title = doc.title.replace(/^[#\s\d-]+/, '').trim();
            // Extract a short overview
            const overviewMatch = doc.content.match(/## Overview\s*([^\n]+)/);
            const shortOverview = overviewMatch ? overviewMatch[1].trim() : '';
            // Simple emoji extraction (first non-whitespace character if it's an emoji)
            const emojiMatch = doc.content.match(/^\s*([\p{Emoji}]+)/u);
            const emoji = emojiMatch ? emojiMatch[1] : '📄'; // Default emoji
            // Extract sequence number from slug (e.g., '01-introduction')
            const sequenceNumberMatch = doc.slug.match(/^(\d+)-/);
            const sequenceNumber = sequenceNumberMatch ? sequenceNumberMatch[1] : null;

            return (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="relative group flex flex-col bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-xl transition-all duration-300 ease-in-out overflow-hidden h-full"
              >
                {/* Sequence Number Badge */}
                {sequenceNumber && (
                  <div className="absolute top-3 right-3 bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    #{sequenceNumber}
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl mt-1 flex-shrink-0">{emoji}</span>
                    <h3 className="text-xl font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-200 mr-8">
                      {title}
                    </h3>
                  </div>
                  {shortOverview && (
                    <p className="text-sm text-gray-600 line-clamp-3 flex-grow mb-4">
                      {shortOverview}
                    </p>
                  )}
                  <div className="mt-auto text-sm font-medium text-blue-600 group-hover:text-blue-800 flex items-center transition-colors duration-200">
                    Read guide
                    <svg className="ml-1.5 w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
