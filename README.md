# Memoir

A personal memory vault that preserves your relationships and shared 
experiences — with an interactive knowledge graph to visualize how 
people and memories connect.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-green)
![React](https://img.shields.io/badge/React-18-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-blue)

## What is Memoir?

Memoir helps you preserve the people in your life and the memories 
you've shared with them. Store photos and text entries linked to 
specific people, and explore those connections through a dynamic 
relationship graph.

Think of it as a personal CRM meets memory journal, built for 
human relationships.

---
## Workflow

![Memoir Workflow](docs/memoir-workflow.svg)

## Features

- **Memory Storage** — Add text and photos tied to people in your life
- **Relationship Graph** — Interactive force-directed graph showing 
  how people connect
- **People Management** — Track relationships by category 
  (Family, Friends, Colleagues)
- **AI Search** — Natural language search through your memories using RAG
- **PDF Export** — Generate beautiful PDF memoirs for any person
- **REST API** — Clean FastAPI backend with full CRUD operations
- **Persistent Storage** — PostgreSQL with SQLAlchemy ORM

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | FastAPI, Python 3.11                |
| Database | PostgreSQL, SQLAlchemy              |
| Frontend | React 18, Tailwind CSS 4, Framer Motion |
| Icons    | Lucide React                        |
| API      | RESTful with Pydantic validation    |

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

```env
DATABASE_URL=postgresql://user:password@localhost:5432/memoir_db
```

### Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.  
API docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Reference

### Authentication

| Method | Endpoint   | Description      |
|--------|------------|------------------|
| POST   | /sign_up   | Create account   |
| POST   | /login     | Sign in          |

### Categories

| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /home/categories      | List all categories |
| POST   | /home/category        | Create a category   |

### People

| Method | Endpoint                    | Description          |
|--------|-----------------------------|----------------------|
| GET    | /home/category/{id}/people  | Get people in category |
| POST   | /home/person                | Add a new person     |
| GET    | /home/person/{id}/files     | Get person's files   |
| POST   | /home/person/{id}/upload    | Upload photo         |
| GET    | /home/person/{id}/pdf       | Download PDF memoir  |

### Memories

| Method | Endpoint                      | Description            |
|--------|-------------------------------|------------------------|
| GET    | /home/person/{id}/memories    | Get person's memories  |
| POST   | /home/person/{id}/memory      | Add memory to person   |

### Search

| Method | Endpoint          | Description          |
|--------|-------------------|----------------------|
| POST   | /home/rag/query   | AI search memories   |

---

## Roadmap

- [ ] Audio notes storage
- [ ] Timeline view sorted by date
- [ ] Mobile-responsive refinements
- [ ] Tags and filtering system
- [ ] Sharing and collaboration features

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student, ANITS Vizag

---

## License

This project is open source and available under the [MIT License](LICENSE).
