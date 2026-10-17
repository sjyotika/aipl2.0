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
- 🌍 **Multilingual Sessions** — English, Hindi, Marathi, Telugu, and Tamil response and speech locales
- 🖼️ **Diagram Evidence** — Attach private PNG, JPEG, or WEBP images for vision-assisted evaluation
- 📊 **Evaluation Reports** — Scores, gaps, misconceptions, suggestions
- 📈 **Analytics Dashboard** — Track learning progress over time
- 🔐 **Auth** — Email/password + Google OAuth via Supabase
- ⚡ **Dual LLM Fallback** — Groq primary → Gemini fallback for reliability

---

## 🚀 v1.1 Performance & Accuracy Update

We recently shipped a major update addressing speed and scoring consistency:
- **Instant Chat Streaming:** Unblocked the AI provider layer to stream chunks directly to the UI for near-zero TTFB.
- **Parallel Mode Detection:** Understanding vs. Socratic mode detection runs concurrently with response streaming, cutting LLM latency in half.
- **Concurrent Eval Safety:** Implemented database locking (`status: 'evaluating'`) to prevent dashboard polling from firing redundant evaluation passes.
- **O(1) Vector Bulk Inserts:** Replaced O(N) sequential vector chunk inserts with a native Supabase bulk insert, dramatically speeding up PDF processing.
- **Deterministic Math:** Moved `overall_score` calculation out of the LLM and into a strict mathematical formula `(accuracy * 0.6) + (coverage * 0.4)` to prevent AI math hallucinations.
- **RAG Context Filtering:** Added a strict `>= 0.6` cosine similarity threshold for vector search to eliminate context noise.
- **Analytics Caching:** Wrapped dashboard aggregations in Next.js `unstable_cache` for instant dashboard loading.

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
| Embeddings | Transformers.js local `paraphrase-multilingual-MiniLM-L12-v2` (Hugging Face hosted API optional) |
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
- Supabase Storage service-role key for private image uploads
- Optional Faster-Whisper HTTP service URL for server transcription

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

Apply `supabase/migrations/001_vector_search.sql` in your Supabase SQL Editor, or run it against the configured database with:

```bash
npx prisma db execute --file supabase/migrations/001_vector_search.sql
```

The migration enables pgvector and creates the insert/search RPCs used by RAG. It returns `document_id` from the search function so invalid or unrelated documents can be filtered by the application.

The migration is the source of truth for manual SQL setup.

### 5. Generate Prisma Client & Push Schema

```bash
npx prisma generate
npx prisma db push
```

### Multilingual and image configuration

Set these server-only variables in `.env.local` when using the extended input pipeline:

```env
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
FASTER_WHISPER_URL=https://your-whisper-service/transcribe
GEMINI_VISION_MODEL=gemini-2.0-flash
MAX_IMAGE_SIZE_MB=5
```

Local embeddings download the `Xenova/paraphrase-multilingual-MiniLM-L12-v2` model on first use and produce the 384-dimensional vectors required by pgvector. Set `EMBEDDING_PROVIDER=huggingface` only when hosted Hugging Face inference access is enabled.

`FASTER_WHISPER_URL` is optional. Without it, supported browsers use their native speech recognition with the selected locale. Chat uses Groq first and falls back to Gemini, while image uploads are stored in a private Supabase `images` bucket and accessed by the server through short-lived signed URLs.

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
