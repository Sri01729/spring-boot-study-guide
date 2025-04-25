import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Asciidoctor from 'asciidoctor';

const contentDirectory = path.join(process.cwd(), 'content');
const asciidoctor = new Asciidoctor();

export interface DocContent {
  slug: string;
  title: string;
  content: string;
  order: number;
}

export function getAllDocs(): DocContent[] {
  const files = fs.readdirSync(contentDirectory);

  const docs = files.map((fileName) => {
    const slug = fileName.replace(/\.(md|adoc)$/, '');
    const filePath = path.join(contentDirectory, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (fileName.endsWith('.md')) {
      const { data, content } = matter(fileContent);
      const order = parseInt(slug.split('-')[0]) || 999;

      return {
        slug,
        title: data.title || slug,
        content,
        order,
      };
    } else if (fileName.endsWith('.adoc')) {
      const doc = asciidoctor.load(fileContent);
      const order = parseInt(slug.split('-')[0]) || 999;

      return {
        slug,
        title: doc.getTitle() || slug,
        content: doc.convert(),
        order,
      };
    }
  }).filter(Boolean);

  return docs.sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string): DocContent | null {
  try {
    const files = fs.readdirSync(contentDirectory);
    const file = files.find(f => f.startsWith(slug));

    if (!file) return null;

    const filePath = path.join(contentDirectory, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (file.endsWith('.md')) {
      const { data, content } = matter(fileContent);
      const order = parseInt(slug.split('-')[0]) || 999;

      return {
        slug,
        title: data.title || slug,
        content,
        order,
      };
    } else if (file.endsWith('.adoc')) {
      const doc = asciidoctor.load(fileContent);
      const order = parseInt(slug.split('-')[0]) || 999;

      return {
        slug,
        title: doc.getTitle() || slug,
        content: doc.convert(),
        order,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting doc by slug:', error);
    return null;
  }
}