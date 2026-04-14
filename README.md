# 🧠 Scholarium — AI Peer Learning System

> **Learn by Teaching** — An AI-powered platform based on the **Protégé Effect**, where you teach a curious AI peer and deepen your own understanding through Socratic dialogue.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss)

---

## 📌 What is Scholarium?

Scholarium flips traditional learning on its head. Instead of an AI *teaching* you, **you teach the AI**. The AI acts as a curious peer student named **Aria** who asks Socratic questions to surface gaps in your understanding — without ever giving you the answer.

### How It Works

1. **Pick a Topic** — Enter any subject you want to master
2. **Upload a PDF** *(optional)* — Provide reference material for more accurate assessment
3. **Teach Aria** — Explain the topic in your own words
4. **Get Questioned** — Aria asks probing questions about gaps she detects
5. **Get Evaluated** — Receive a detailed report with scores, gaps, and suggestions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Next.js 16 (App Router) + React 19 + Tailwind  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Auth     │ │Dashboard │ │  Chat Interface  │ │
│  │  Pages    │ │  + Stats │ │  + Voice Input   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└───────────────────┬─────────────────────────────┘
                    │ API Routes
┌───────────────────▼─────────────────────────────┐
│                   Backend                        │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ │
│  │  Chat  │ │Upload  │ │ Evaluate │ │Sessions│ │
│  │  API   │ │  API   │ │   API    │ │  API   │ │
│  └───┬────┘ └───┬────┘ └────┬─────┘ └────────┘ │
│      │          │           │                    │
│  ┌───▼──────────▼───────────▼──────────────────┐│
│  │           AI Layer                           ││
│  │  Groq (Llama 3.3 70B) ←→ Gemini 2.0 Flash  ││
│  │  Mode Detection │ Prompt Engineering │ RAG   ││
│  └──────────────────────────────────────────────┘│
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│              Supabase (PostgreSQL)               │
│  Users │ Sessions │ Messages │ Documents │ pgvec│
└─────────────────────────────────────────────────┘
```

---

## ✨ Features

- 🎭 **Socratic AI Peer** — Aria never teaches; only questions
- 🔄 **Dual-Mode System** — Auto-switches between Understanding & Socratic modes
- 📄 **PDF RAG Pipeline** — Upload docs for ground-truth reference
- 🎤 **Voice Input** — Speak your explanations with live transcription
- 📊 **Evaluation Reports** — Scores, gaps, misconceptions, suggestions
- 📈 **Analytics Dashboard** — Track learning progress over time
- 🔐 **Auth** — Email/password + Google OAuth via Supabase
- ⚡ **Dual LLM Fallback** — Groq primary → Gemini fallback for reliability

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Frontend | React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| Vector DB | pgvector (384-dim embeddings) |
| Primary LLM | Groq — Llama 3.3 70B Versatile |
| Fallback LLM | Google Gemini 2.0 Flash |
| Embeddings | HuggingFace BAAI/bge-small-en-v1.5 |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Voice | Web Speech API |
| Validation | Zod |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)
- Groq API key ([console.groq.com](https://console.groq.com))
- Google AI API key ([aistudio.google.com](https://aistudio.google.com))
- HuggingFace API key ([huggingface.co/settings/tokens](https://huggingface.co/settings/tokens))

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-peer-system.git
cd ai-peer-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual API keys (see `.env.example` for the full list).

### 4. Set Up Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Vector insert function
create or replace function insert_document_chunk(
  p_document_id uuid,
  p_content text,
  p_embedding vector(384),
  p_metadata jsonb
) returns void as $$
begin
  insert into document_chunks (id, document_id, content, embedding, metadata)
  values (gen_random_uuid(), p_document_id, p_content, p_embedding, p_metadata);
end;
$$ language plpgsql;

-- Vector search function
create or replace function match_document_chunks(
  query_embedding vector(384),
  match_count int,
  p_session_id uuid
) returns table (content text, similarity float) as $$
begin
  return query
    select dc.content, 1 - (dc.embedding <=> query_embedding) as similarity
    from document_chunks dc
    join documents d on d.id = dc.document_id
    where d.session_id = p_session_id
    and dc.embedding is not null
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$ language plpgsql;
```

### 5. Generate Prisma Client & Push Schema

```bash
npx prisma generate
npx prisma db push
```

### 6. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
ai-peer-system/
├── prisma/
│   └── schema.prisma          # Database schema (5 models)
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login, Register, Callback
│   │   ├── (app)/             # Dashboard, Session, Onboarding
│   │   └── api/               # 6 API routes
│   ├── components/
│   │   ├── session/           # Chat interface
│   │   ├── dashboard/         # Dashboard & report components
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── ai/                # Prompts, provider, session-manager
│   │   ├── evaluation/        # Evaluation engine + Zod schema
│   │   ├── rag/               # PDF parser, chunker, embeddings, vector store
│   │   ├── supabase/          # Client, server, middleware
│   │   └── auth/              # Auth actions
│   └── proxy.ts               # Auth guard (Next.js 16 proxy)
├── .env.example               # Environment variable template
├── package.json
└── README.md
```

---

## 📊 Evaluation Report Format

After each session, students receive:

| Metric | Description |
|--------|-------------|
| Overall Score | 0-100 combined understanding score |
| Accuracy Score | Factual correctness |
| Coverage Score | Topic coverage breadth |
| Conceptual Gaps | List of missed concepts |
| Misconceptions | Wrong claims + corrections |
| Suggestions | Actionable improvement advice |
| Session Narrative | How the explanation evolved |

---

## 🔑 API Keys Required

| Service | Purpose | Get It |
|---------|---------|--------|
| Supabase | Database + Auth + Storage | [supabase.com](https://supabase.com) |
| Groq | Primary LLM (Llama 3.3) | [console.groq.com](https://console.groq.com) |
| Google AI | Fallback LLM (Gemini) | [aistudio.google.com](https://aistudio.google.com) |
| HuggingFace | Text embeddings | [huggingface.co](https://huggingface.co/settings/tokens) |

---

## 📄 License

MIT
---

Built with ❤️ using the **Protégé Effect** — because the best way to learn is to teach.
