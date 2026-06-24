# Memoir

> *Your family's story, preserved forever — a private social space for the people who matter most.*

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?style=flat-square&logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## What is Memoir?

Memoir is a **private family social network** — think Instagram, but invite-only and built for your family.

Post photos, celebrate birthdays, comment in real-time, and preserve memories in a shared family vault. Everything stays within your family — no algorithm, no ads, no strangers.

Built on a warm stationery-inspired design system with an interactive relationship graph, AI-powered memory search, and one-click PDF memoir generation.

---

## Features

| Feature | Description |
|---|---|
| 📸 **Family Feed** | Instagram-style feed — post photos, like, comment in real-time |
| 🎭 **Stories** | 24-hour disappearing photo/video stories with view counters |
| 🎂 **Birthday & Anniversary Alerts** | Auto-detects upcoming birthdays, one-tap to post a wish |
| 🔒 **Family Vault** | Role-gated archive for important docs, photos, and videos |
| 🔔 **Real-time Notifications** | WebSocket-driven likes, comments, tags, and birthday alerts |
| 🕸️ **Relationship Graph** | Interactive D3.js force graph visualizing how everyone connects |
| 🧠 **AI Memory Search** | Natural language search across all memories using RAG + pgvector |
| 📄 **PDF Memoir Export** | One-click beautifully formatted memoir PDF per person |
| 🔐 **Invite-Only Auth** | No public signup — join via family invite link only |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL, SQLAlchemy ORM, pgvector |
| Cache / Queue | Redis, Celery |
| Frontend | React 18, Vite 5, Tailwind CSS 4, Framer Motion 11 |
| Graph | D3.js 7 |
| Real-time | WebSockets |
| Media Storage | Cloudflare R2 / AWS S3 |
| AI / Search | RAG pipeline, sentence-transformers, pgvector |
| Auth | JWT + bcrypt, role-based (admin / member) |
| Icons | Lucide React |

---

## Project Structure

```
Memoir/
├── backend/
│   ├── routes/
│   │   └── main.py           # All API endpoints (~30 routes)
│   ├── database/
│   │   ├── models.py         # SQLAlchemy models + Pydantic schemas
│   │   └── config.py         # DB engine, session, pgvector detection
│   ├── agent/
│   │   └── __init__.py       # Tool-based conversational agent
│   ├── rag/
│   │   └── vector_store.py   # Hybrid semantic + keyword search
│   ├── graph/
│   │   └── algorithms.py     # BFS, Union-Find, degree centrality
│   ├── scheduling/
│   │   └── sm2.py            # SM-2 spaced repetition (memory resurfacing)
│   ├── jobs/
│   │   └── tasks.py          # Celery background tasks
│   └── utils/
│       └── __init__.py       # API key encryption helpers
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── BottomTabBar.jsx
│   │   │   ├── MemoryCard.jsx
│   │   │   ├── FloatingChatButton.jsx
│   │   │   └── ui/           # Avatar, Button, Modal, Toast
│   │   ├── pages/            # 11 pages (Feed, Vault, Graph, Profile...)
│   │   ├── lib/
│   │   │   └── api.js        # Axios instance + all API wrappers
│   │   ├── App.jsx
│   │   └── index.css         # Tailwind 4 + Letter Box design tokens
│   └── vite.config.js
├── requirements.txt
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (running locally)
- Redis (for Celery tasks)

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
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/memoir_db
REDIS_URL=redis://localhost:6379
SECRET_KEY=your_secret_key
R2_BUCKET=your_bucket
R2_ACCESS_KEY=your_key
R2_SECRET_KEY=your_secret
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — Celery worker
celery -A jobs.tasks worker --loglevel=info
```

- App → [http://localhost:5173](http://localhost:5173)
- API Docs → [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Current user |

### Feed & Posts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/feed` | Paginated family feed |
| POST | `/posts` | Create a post |
| POST | `/posts/:id/like` | Like / unlike |
| POST | `/posts/:id/comment` | Add comment |
| WS | `/ws/comments/:id` | Real-time comments |

### Stories
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stories` | Active stories (last 24hr) |
| POST | `/stories` | Create a story |

### Family Vault
| Method | Endpoint | Description |
|---|---|---|
| GET | `/vault` | List vault items |
| POST | `/vault/upload` | Upload to vault |

### Memories
| Method | Endpoint | Description |
|---|---|---|
| GET | `/people/:id/memories` | List memories |
| POST | `/people/:id/memories` | Add memory |
| POST | `/family/:id/search` | Keyword search |
| POST | `/home/rag/query` | AI semantic search |

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
- [x] AI-powered search (RAG + pgvector)
- [x] PDF memoir export
- [ ] Instagram-style feed + likes + comments
- [ ] Stories (24hr)
- [ ] Birthday alerts + wish posts
- [ ] Family vault with role-based access
- [ ] Real-time notifications (WebSocket)
- [ ] Mobile app (React Native)

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student · ANITS, Visakhapatnam

---

## License

MIT — open source, free to use. See [LICENSE](LICENSE) for details.
