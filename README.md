This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Glance Buddy - PDF & URL Summary Generator

Glance Buddy is a web application that allows users to upload PDFs or provide URLs to generate summaries and chat with the content using RAG (Retrieval Augmented Generation).

## AI Services

This application uses several AI services:

- **[Jina AI](https://jina.ai/)** for:
  - Embedding generation via the Jina Embeddings API

- **[Groq](https://groq.com/)** for:
  - LLM inference using the Llama 3.1 models for chat and summarization

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This application requires the following environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
JINA_API_KEY=your_jina_api_key
GROQ_API_KEY=your_groq_api_key
```

## Feature Overview

- Upload and process PDF files
- Enter URLs to process web content
- Generate concise summaries of documents
- Chat with documents using RAG
- View your library of previously processed documents

## Supabase Setup

This application uses Supabase for database and vector storage. Make sure to set up the required SQL functions by following the instructions in `SUPABASE_SQL_SETUP.md`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
