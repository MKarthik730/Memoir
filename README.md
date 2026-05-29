# Memoir

> *A personal memory vault that preserves the people you love and the moments you've shared — visualized through an interactive knowledge graph.*

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?style=flat-square&logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## What is Memoir?

Memoir is a **personal CRM meets memory journal** — built for human relationships, not business ones.

Store photos and text entries linked to the people in your life. Explore how those connections weave together through a dynamic, force-directed relationship graph. Generate a beautifully exported PDF memoir for any person with one click.

It's for the moments you don't want to forget. The people who matter.

---

## Features

| Feature | Description |
|---|---|
| 🧠 **AI Memory Search** | Natural language search across all your memories using RAG |
| 🕸️ **Relationship Graph** | Interactive force-directed graph visualizing how people connect |
| 🗂️ **People Management** | Organize relationships by category — Family, Friends, Colleagues |
| 📸 **Photo & Text Memories** | Attach photos and rich text entries to any person |
| 📄 **PDF Export** | One-click, beautifully formatted memoir PDF for any person |
| 🔐 **Auth System** | Secure signup/login with user-scoped data |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL, SQLAlchemy ORM |
| Frontend | React 18, Tailwind CSS 4, Framer Motion |
| AI / Search | RAG pipeline with vector embeddings |
| Icons | Lucide React |
| Validation | Pydantic |

---

## Project Structure

```
Memoir/
├── backend/
│   ├── routes/
│   │   └── main.py           # FastAPI app + all route definitions
│   ├── database/
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── config.py         # DB connection configuration
│   ├── rag/
│   │   ├── main.py           # RAG query pipeline
│   │   ├── embeddings.py     # Embedding generation utilities
│   │   └── vector_store.py   # Vector storage layer
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
├── docs/
│   └── memoir-workflow.svg
├── requirements.txt
├── render.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (running locally)

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
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- App → [http://localhost:5173](http://localhost:5173)
- API Docs → [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sign_up` | Create a new account |
| POST | `/login` | Sign in |

### Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/categories` | List all categories |
| POST | `/home/category` | Create a category |

### People

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/category/{id}/people` | Get people in a category |
| POST | `/home/person` | Add a new person |
| GET | `/home/person/{id}/files` | Get person's uploaded files |
| POST | `/home/person/{id}/upload` | Upload a photo |
| GET | `/home/person/{id}/pdf` | Download PDF memoir |

### Memories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/home/person/{id}/memories` | List memories for a person |
| POST | `/home/person/{id}/memory` | Add a memory |

### Search

| Method | Endpoint | Description |
|---|---|---|
| POST | `/home/rag/query` | AI-powered natural language search |

---

## Roadmap

- [ ] Timeline view sorted by date
- [ ] Audio note storage
- [ ] Tags and filtering system
- [ ] Mobile-responsive refinements
- [ ] Sharing and collaboration features

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student · ANITS, Visakhapatnam

---

## License

MIT License — open source, free to use. See [LICENSE](LICENSE) for details.
