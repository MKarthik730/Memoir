# Memoir

> *A private family diary — write it down today, and get it handed back to you on this day next year.*

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![SQLite%2FPostgres](https://img.shields.io/badge/DB-SQLite%20%2F%20PostgreSQL-336791?style=flat-square&logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## What is Memoir?

Memoir is a **private family diary**, not a social feed. Family members write dated entries and letters for one another — no likes, no comments, no stories, no algorithm. Just a running, chronological record of what happened, who it happened to, and when.

On top of the diary, Memoir actively helps you keep it: it resurfaces "On This Day" entries from previous years, nudges you toward memories worth revisiting with a spaced-repetition scheduler, points out family members nobody's written about in a while, plots everything on a calendar, and lets you ask a conversational assistant about your family's history. A relationship graph visualizes how everyone connects, and any person's memories can be bound into a one-click PDF memoir.

Built on a warm, stationery-inspired design system — parchment backgrounds, wax-seal accents, postmark-style date stamps.

---

## Features

| Feature | Description |
|---|---|
| 📓 **Diary Feed** | Chronological family diary — dated, postmarked entries with photos and location, no engagement metrics |
| ✨ **On This Day** | Surfaces entries and memories from this same date in past years |
| 💚 **Worth Revisiting** | SM-2 spaced-repetition scheduler resurfaces older memories to keep or let fade |
| 👥 **Neglected Connections** | Nudges you toward family members nobody's written a memory for in a while |
| 📅 **Calendar** | Month view of diary entries, memories, birthdays, and trips |
| 🎂 **Birthday Alerts** | Auto-detects upcoming birthdays, one tap to write a wish |
| 🗄️ **Family Vault** | Shared archive for important documents, photos, and videos |
| 🕸️ **Relationship Graph** | Interactive D3.js force graph visualizing how everyone connects |
| 🔍 **Hybrid Memory Search** | Semantic (embeddings) + keyword search over every memory, weighted and re-ranked |
| 🤖 **Memory Assistant** | Conversational agent that calls real tools (search, relationships, trips, resurfacing) — upgrades to genuine LLM tool-calling once you add your own API key |
| 📄 **PDF Memoir Export** | One-click, beautifully formatted memoir PDF per person |
| 🔐 **Invite-Only Auth** | No public signup — join a family via invite link only |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| Database | SQLite by default, PostgreSQL supported — SQLAlchemy ORM |
| Frontend | React 18, Vite 5, Tailwind CSS 4, Framer Motion 11 |
| Graph | D3.js 7 |
| Media Storage | Local disk (`UPLOAD_DIR`) |
| Search | Hybrid semantic + keyword search, computed in Python — no database extension required |
| AI (optional) | `sentence-transformers` for semantic search; OpenAI / Anthropic / Groq for the assistant, via a user-supplied API key |
| Background jobs (optional) | Celery + Redis, for future async work — not required to run the app |
| Auth | JWT + bcrypt |
| Icons | Lucide React |

---

## Project Structure

```
Memoir/
├── backend/
│   ├── routes/
│   │   └── main.py           # All API endpoints
│   ├── database/
│   │   ├── models.py         # SQLAlchemy models + Pydantic schemas
│   │   └── config.py         # DB engine, session, migrations
│   ├── agent/
│   │   └── __init__.py       # Tool-based conversational agent (keyword router + LLM tool-calling)
│   ├── rag/
│   │   └── vector_store.py   # Hybrid semantic + keyword search
│   ├── graph/
│   │   └── algorithms.py     # BFS, Union-Find, degree centrality
│   ├── scheduling/
│   │   └── sm2.py            # SM-2 spaced repetition (memory resurfacing)
│   ├── jobs/
│   │   └── tasks.py          # Optional Celery background tasks
│   └── utils/
│       └── __init__.py       # API key encryption + LLM client helpers
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── BottomTabBar.jsx
│   │   │   ├── MemoryCard.jsx
│   │   │   ├── FloatingChatButton.jsx
│   │   │   └── ui/           # Avatar, Button, Modal, Toast
│   │   ├── pages/            # Diary, Calendar, Vault, Graph, Profile, Trips...
│   │   ├── lib/
│   │   │   └── api.js        # Axios instance + all API wrappers
│   │   ├── App.jsx
│   │   └── index.css         # Tailwind 4 + stationery design tokens
│   └── vite.config.js
├── requirements.txt
├── requirements-ai.txt       # Optional: semantic search (sentence-transformers)
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

No database server or Redis is required to run locally — the app defaults to a local SQLite file.

### 1. Clone the repo

```bash
git clone https://github.com/MKarthik730/Memoir.git
cd Memoir
```

### 2. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional — adds semantic (meaning-based) search on top of keyword search:
pip install -r requirements-ai.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Configure environment

Create a `.env` file in `backend/` (see `backend/.env.example`):

```env
DATABASE_URL=sqlite:///./memoir.db
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:5173
```

To use PostgreSQL instead, set `DATABASE_URL=postgresql://user:password@host:5432/dbname`.

### 5. Run

```bash
# Terminal 1 — Backend (from the repo root)
uvicorn backend.routes.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- App → [http://localhost:5173](http://localhost:5173)
- API Docs → [http://localhost:8000/docs](http://localhost:8000/docs)

Each user can add their own OpenAI, Anthropic, or Groq API key in **Settings** to turn the chat assistant into a real LLM tool-calling agent — without a key, it still works via keyword-routed tool calls.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Current user |

### Diary
| Method | Endpoint | Description |
|---|---|---|
| GET | `/feed` | Paginated diary timeline |
| POST | `/posts` | Write a diary entry |

### Memories & People
| Method | Endpoint | Description |
|---|---|---|
| GET | `/people/:id/memories` | List memories for a person |
| POST | `/people/:id/memories` | Add a memory |
| POST | `/family/:id/search` | Hybrid semantic + keyword search |
| POST | `/home/rag/query` | Search with an explicit mode (`semantic` \| `keyword` \| `hybrid`) |

### Life Assistant
| Method | Endpoint | Description |
|---|---|---|
| GET | `/family/:id/on-this-day` | Entries/memories from this date in past years |
| GET | `/home/resurface` | Memories due for spaced-repetition review |
| POST | `/memories/:id/review` | Record a review (reschedules via SM-2) |
| GET | `/family/:id/neglected` | Family members nobody's written about lately |
| GET | `/family/:id/calendar` | Month view of entries, memories, birthdays, trips |
| POST | `/home/assistant/chat` | Conversational assistant (streamed) |

### Family Vault
| Method | Endpoint | Description |
|---|---|---|
| GET | `/vault` | List vault items |
| POST | `/vault/upload` | Upload to vault |

### Graph
| Method | Endpoint | Description |
|---|---|---|
| GET | `/graph/path` | Shortest path between people |
| GET | `/graph/communities` | Family subgraph clusters |
| GET | `/graph/centrality` | Most connected person |

---

## Roadmap

- [x] Auth + invite-only family system
- [x] People + relationship graph
- [x] Memory storage with photos
- [x] Hybrid semantic + keyword search
- [x] PDF memoir export
- [x] Diary feed (chronological, no social metrics)
- [x] On This Day + spaced-repetition resurfacing
- [x] Calendar view
- [x] LLM tool-calling assistant (BYOK)
- [ ] Family vault with role-based access
- [ ] Mobile app (React Native)

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student · ANITS, Visakhapatnam

---

## License

MIT — open source, free to use. See [LICENSE](LICENSE) for details.
