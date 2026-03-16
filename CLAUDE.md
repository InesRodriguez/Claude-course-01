# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup (first time)
npm run setup        # install deps + prisma generate + migrate

# Development
npm run dev          # Next.js dev server with Turbopack

# Build & Run
npm run build
npm run start

# Lint & Test
npm run lint
npm run test         # Vitest

# Database
npm run db:reset     # Reset and re-migrate (destructive)
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

## Architecture

**UIGen** is an AI-powered React component generator. Users describe components in natural language; Claude generates code that runs live in an iframe preview.

### Core Data Flow

```
User prompt → /api/chat → Claude (with tools) → VirtualFileSystem → JSX Babel transform → iframe preview
```

1. `ChatContext` (`src/lib/contexts/chat-context.tsx`) wraps Vercel AI SDK's `useChat`, sending the current virtual FS state to `/api/chat`.
2. `/api/chat/route.ts` streams Claude's response with two tools: `str_replace_editor` (create/view/edit files) and `file_manager` (rename/delete).
3. Tool calls update `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`), which holds the in-memory `VirtualFileSystem` (`src/lib/file-system.ts`).
4. `PreviewFrame` detects file changes, compiles JSX with Babel standalone (`src/lib/transform/jsx-transformer.ts`), builds an import map, and injects everything into the iframe.

### Key Architectural Decisions

- **No real disk I/O for generated files** — the entire project lives in a `VirtualFileSystem` (in-memory tree). Only persistence is via Prisma serialization on `onFinish`.
- **AI model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via `@ai-sdk/anthropic`. Falls back to `MockLanguageModel` when `ANTHROPIC_API_KEY` is absent (`src/lib/provider.ts`).
- **System prompt** (`src/lib/prompts/generation.tsx`) instructs Claude to always use `/App.jsx` as root, use Tailwind CSS, and import with `@/` alias.
- **Anonymous projects**: projects can exist without a userId. Authentication is optional; middleware only protects `/api/projects` and `/api/filesystem`.
- **Path alias**: `@/*` → `./src/*` (tsconfig).

### Project Pages

| Route | Description |
|---|---|
| `/` | Home — redirects authenticated users to their latest project |
| `/[projectId]` | Workspace (chat + code editor + preview panels) |
| `/api/chat` | Streaming AI endpoint |

### Database (Prisma + SQLite)

Schema: `prisma/schema.prisma`. Two models:
- `User` — email + bcrypt password
- `Project` — name, optional userId, JSON messages + file data

Sessions use JWT stored in HttpOnly cookies (`src/lib/auth.ts`, 7-day expiry, `jose` library).

## Code Style

- Use comments sparingly — only for complex logic that isn't self-evident.

## Environment

Copy `.env.example` to `.env` and set:
```
ANTHROPIC_API_KEY=...   # optional; app works with mock model if absent
```
