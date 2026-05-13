# Memoir

> A personal memory vault that preserves your relationships and shared experiences — with an interactive knowledge graph to visualize how people and memories connect.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.2-38bdf8?style=flat-square&logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-12.38-pink?style=flat-square)

---

## What is Memoir?

Memoir helps you preserve the people in your life and the memories you've shared with them. You can store photos and text entries linked to specific people — and explore those connections through a dynamic relationship graph.

Think of it as a **personal CRM meets memory journal**, built for human relationships.

---

## Features

- **Memory Storage** — Add text and photos tied to people in your life
- **Relationship Graph** — Interactive force-directed graph showing how people connect
- **People Management** — Track relationships by category (Family, Friends, Colleagues)
- **AI Search** — Natural language search through your memories using RAG
- **PDF Export** — Generate beautiful PDF memoirs for any person
- **REST API** — Clean FastAPI backend with full CRUD operations
- **Persistent Storage** — PostgreSQL with SQLAlchemy ORM for reliable data modeling

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL, SQLAlchemy |
| Frontend | React 18, Tailwind CSS 4, Framer Motion |
| Icons | Lucide React |
| API | RESTful with Pydantic validation |

---

## Project Structure

```
Memoir/
├── backend/
│   ├── routes/
│   │   └── main.py          # FastAPI app entry point
│   ├── database/
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   └── config.py        # Database configuration
│   ├── rag/
│   │   ├── main.py          # RAG implementation
│   │   ├── embeddings.py    # Embedding utilities
│   │   └── vector_store.py  # Vector storage
│   └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── PersonDetail.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   └── GraphPage.jsx
│   │   ├── lib/
│   │   │   └── utils.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── requirements.txt
├── render.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL running locally
- Node.js 18+

### Installation

```bash
git clone https://github.com/MKarthik730/Memoir.git
cd Memoir

# Backend setup
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd frontend
npm install
```

### Configure Database

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/memoir_db
```

### Run

```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.  
API docs available at `http://localhost:8000/docs`

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sign_up` | Create new account |
| POST | `/login` | Sign in |

### Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/categories` | List all categories |
| POST | `/home/category` | Create a category |

### People

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/category/{id}/people` | Get people in category |
| POST | `/home/person` | Add a new person |
| GET | `/home/person/{id}/files` | Get person's files |
| POST | `/home/person/{id}/upload` | Upload photo |
| GET | `/home/person/{id}/pdf` | Download PDF memoir |

### Memories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/person/{id}/memories` | Get person's memories |
| POST | `/home/person/{id}/memory` | Add memory to person |

### Search

| Method | Endpoint | Description |
|---|---|---|
| POST | `/home/rag/query` | AI search memories |

---

## What I Learned

- Building React SPAs with component-based architecture
- Styling with Tailwind CSS while maintaining design consistency
- Designing relational schemas for graph-like data (people ↔ memories many-to-many)
- FastAPI dependency injection for database session management
- SQLAlchemy relationship modeling with backref
- Implementing smooth animations with Framer Motion

---

## Future Improvements

- [ ] Audio notes storage
- [ ] Timeline view sorted by date
- [ ] Mobile-responsive refinements
- [ ] Tags and filtering system
- [ ] Sharing/collaboration features

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student, ANITS Vizag | [LinkedIn](https://www.linkedin.com/in/karthik-motupalli-0b6951318)
