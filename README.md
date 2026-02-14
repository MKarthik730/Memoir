# Memoir

Memoir is a web application that helps you preserve and visualize your personal relationships and shared memories.  
Store photos, audio notes, and text about the people in your life, and see how they connect through an interactive relationship graph.

## Features

- Create an account and securely log in with JWT-based authentication
- Upload and manage files (images, audio, documents) associated with your memories
- Organize people into categories (e.g., family, friends, colleagues)
- View an interactive relationship graph of the people in your life
- Responsive frontend with simple, fast UX

## Tech Stack

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)

Memoir is a web application that helps you preserve and visualize your personal relationships and shared memories.  
Store photos, audio notes, and text about the people in your life, and see how they connect through an interactive relationship graph.

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL/SQLite (configurable)
- **Auth:** JWT (JSON Web Tokens) with password hashing (bcrypt)
- **Frontend:** Vanilla JavaScript, HTML, CSS
- **Other:** CORS, file uploads, Pydantic models for validation

## Project Structure

```bash
.
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── database/
│   │   ├── models.py        # SQLAlchemy ORM models (User, FileStore, Category, Person, etc.)
│   │   └── config.py        # DB engine and SessionLocal
│   └── ...                  # Other backend modules
├── frontend/
│   ├── index.html           # Landing / login page
│   ├── signup.html          # Signup page
│   ├── memoir_dashboard.html# Dashboard with file upload & listing
│   ├── static/
│   │   ├── app.js           # Shared frontend JS (auth, upload, list)
│   │   └── styles.css       # Styling
└── README.md
