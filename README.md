# Memoir 🧠

> A personal memory vault that preserves your relationships and shared experiences — with an interactive knowledge graph to visualize how people and memories connect.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green?style=flat-square&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-red?style=flat-square)
![D3.js](https://img.shields.io/badge/D3.js-v7-orange?style=flat-square&logo=d3dotjs)

---

## What is Memoir?

Memoir helps you preserve the people in your life and the memories you've shared with them. You can store photos, audio notes, and text entries linked to specific people — and explore those connections through an Obsidian-style force-directed knowledge graph.

Think of it as a personal CRM meets memory journal, built for human relationships.

---

## Features

- **Memory Storage** — Add text, photos, and audio notes tied to people or events
- **Relationship Graph** — Interactive D3.js force-directed graph showing how people and memories connect
- **People Management** — Track relationships, categories, and shared history
- **REST API** — Clean FastAPI backend with full CRUD operations
- **Persistent Storage** — PostgreSQL with SQLAlchemy ORM for reliable data modeling

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL, SQLAlchemy |
| Frontend | HTML/CSS/JS, D3.js |
| API | RESTful with Pydantic validation |

---

## Project Structure

```
Memoir/
├── main.py              # FastAPI app entry point
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── database.py          # DB connection and session management
├── routers/
│   ├── people.py        # People CRUD endpoints
│   └── memories.py      # Memory CRUD endpoints
├── static/
│   └── graph.js         # D3.js force graph visualization
└── templates/
    └── index.html       # Frontend UI
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- PostgreSQL running locally

### Installation

```bash
git clone https://github.com/MKarthik730/Memoir.git
cd Memoir

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### Configure Database

```bash
# Create a .env file
DATABASE_URL=postgresql://user:password@localhost:5432/memoir_db
```

### Run

```bash
uvicorn main:app --reload
```

Open `http://localhost:8000` in your browser.

API docs available at `http://localhost:8000/docs`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/people` | List all people |
| POST | `/people` | Add a new person |
| GET | `/memories` | List all memories |
| POST | `/memories` | Add a new memory |
| GET | `/memories/{id}` | Get a specific memory |
| DELETE | `/memories/{id}` | Delete a memory |

---

## What I Learned

- Designing relational schemas for graph-like data (people ↔ memories many-to-many)
- Building force-directed graphs with D3.js from a REST API response
- FastAPI dependency injection for database session management
- SQLAlchemy relationship modeling with backref

---

## Future Improvements

- [ ] Authentication and per-user data isolation
- [ ] Timeline view sorted by date
- [ ] Export memories as PDF
- [ ] Mobile-responsive UI

---

## Author

**Karthik Motupalli** — [@MKarthik730](https://github.com/MKarthik730)  
CS Student, ANITS Vizag | [LinkedIn](https://www.linkedin.com/in/karthik-motupalli-0b6951318)
