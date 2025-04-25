import { getDocBySlug, getAllDocs } from "@/utils/docs"
import { MDXRemote } from "next-mdx-remote/rsc"
import Link from "next/link"
import { notFound } from "next/navigation"
import rehypePrism from "rehype-prism-plus"
import remarkGfm from "remark-gfm"

export async function generateStaticParams() {
  const docs = getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug,
  }))
}

// Define the correct params type
interface DocPageProps {
  params: {
    slug: string;
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const doc = getDocBySlug(params.slug)

  if (!doc) {
    notFound()
  }

  const title = doc.title.replace(/^[#\s\d-]+/, "").trim()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Consistent Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center">
            <svg
              className="mr-2 w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Study Guide
          </Link>
        </div>
      </header>

      {/* Centered Content Column */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Article Title */}
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
        </div>

        {/* Main Content Container - Apply manual styles via class */}
        <article className="manual-markdown-styles space-y-6">
          <MDXRemote
            source={doc.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [rehypePrism],
              },
            }}
          />
        </article>
      </main>
    </div>
  )
}
