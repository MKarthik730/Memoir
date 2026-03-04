# 📔 Memoir

> A web application for storing, managing, and intelligently querying personal memories and journal entries.

---

## 🗂️ Project Structure

```
Memoir/
├── backend/
│   ├── database/
│   │   ├── config.py            # Database configuration & connection pooling
│   │   ├── models.py            # SQLAlchemy models & Pydantic schemas
│   │   └── __init__.py
│   ├── routes/
│   │   ├── main.py              # All API routes
│   │   └── __init__.py
|   ├── rag/
│   └── __init__.py
├── frontend/
│   ├── index.html               # Login page
│   ├── sign_up.html             # Registration page
│   ├── memoir_dashboard.html    # Memoir dashboard view
│   ├── app.js                   # Frontend JavaScript
│   └── styles.css               # Styling
├── .env                         # Environment variables (DO NOT COMMIT!)
├── .gitignore                   # Git ignore rules
├── requirements.txt             # Python dependencies
├── run.py                       # Application launcher
└── README.md                    # This file
```

--

## ✨ Features

- **User Authentication** — Secure sign-up and login flow
- **Memoir Dashboard** — Create, view, and manage personal journal entries
- **FastAPI Backend** — High-performance async REST API
- **SQLAlchemy ORM** — Clean database models with connection pooling
- **Pydantic Schemas** — Request/response validation

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend Framework | FastAPI |
| ASGI Server | Uvicorn |
| ORM | SQLAlchemy |
| Schema Validation | Pydantic |
| Frontend | HTML, CSS, Vanilla JS |
| Environment Config | python-dotenv |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MKarthik730/Memoir.git
   cd Memoir
   ```

2. **Create and activate a virtual environment**
   ```bash
   python -m venv .venv

   # Windows
   .venv\Scripts\Activate.ps1

   # macOS / Linux
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=your_database_url
   SECRET_KEY=your_secret_key
   ```

5. **Run the application**
   ```bash
   python run.py
   ```

6. **Open the app**

   Navigate to `http://localhost:8000` in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive token |
| `GET` | `/memoirs` | Fetch all memoirs |
| `POST` | `/memoirs` | Create a new memoir |
| `PUT` | `/memoirs/{id}` | Update a memoir |
| `DELETE` | `/memoirs/{id}` | Delete a memoir |

> Full interactive API docs available at `http://localhost:8000/docs` (Swagger UI)

---

## 🔒 Security

- `.env` is listed in `.gitignore` and **never committed** to version control
- Passwords are hashed before storage
- JWT-based authentication for all protected routes

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to your branch
   ```bash
   git push origin feature/your-feature
   ```
5. Open a Pull Request on [GitHub](https://github.com/MKarthik730/Memoir)

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**MKarthik730** — [github.com/MKarthik730](https://github.com/MKarthik730)
