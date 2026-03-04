**# Memoir API v2.0

A secure, production-ready web application for preserving and organizing personal relationships and shared memories.

## 🎉 Version 2.0 - Complete Refactor

### ✅ All Issues Fixed

#### **Critical Security Fixes**
- ✅ **SECRET_KEY validation** - Application fails fast if not set
- ✅ **Timezone-aware datetimes** - Fixed `datetime.utcnow()` → `datetime.now(timezone.utc)`
- ✅ **Password strength validation** - Enhanced password requirements
- ✅ **Username validation** - Alphanumeric characters only
- ✅ **SQL injection protection** - Parameterized queries throughout
- ✅ **Error message sanitization** - No sensitive data in errors

#### **Database Improvements**
- ✅ **Connection pooling** - Proper pool configuration with pre-ping
- ✅ **Connection recycling** - Prevents stale connections
- ✅ **Composite indexes** - Better query performance
- ✅ **Foreign key constraints** - CASCADE deletes for data integrity
- ✅ **Column length limits** - Prevents database bloat
- ✅ **Future-proof SQLAlchemy** - Using SQLAlchemy 2.0 style

#### **Code Quality**
- ✅ **Type hints throughout** - Better IDE support
- ✅ **Comprehensive error handling** - Try-catch for all operations
- ✅ **Transaction management** - Proper rollback on errors
- ✅ **Input validation** - Pydantic validators
- ✅ **Logging improvements** - Detailed logging at all levels
- ✅ **Code documentation** - Docstrings for all functions

#### **New Features**
- ✅ **File download endpoint** - Stream files to users
- ✅ **Health check endpoint** - Monitor application status
- ✅ **Better file validation** - Enhanced extension checking
- ✅ **User creation timestamps** - Track when users joined
- ✅ **Improved error responses** - Clear, actionable error messages

#### **API Improvements**
- ✅ **HTTP status codes** - Proper use of 201, 404, 413, etc.
- ✅ **CORS configuration** - Environment-based origins
- ✅ **API versioning** - Version 2.0.0
- ✅ **Response models** - Consistent API responses
- ✅ **File streaming** - Efficient large file handling

## 📋 Features

- 🔐 **JWT Authentication** - Secure token-based auth with bcrypt password hashing
- 📁 **Hierarchical Organization** - User → Categories → People → Files
- 📤 **File Management** - Upload, download, and delete files
- 🎯 **Multi-format Support** - Audio, video, images, documents
- 🔒 **Data Isolation** - Each user's data is completely separate
- 📊 **Structure API** - Get complete relationship hierarchy
- 🏥 **Health Monitoring** - Built-in health check endpoint

## 🏗️ Architecture

```
Memoir/
├── backend/
│   ├── database/
│   │   ├── config.py       # Database configuration & connection pooling
│   │   ├── models.py       # SQLAlchemy models & Pydantic schemas
│   │   └── __init__.py
│   ├── routes/
│   │   ├── main.py         # All API routes
│   │   └── __init__.py
│   └── __init__.py
├── frontend/
│   ├── index.html          # Login page
│   ├── sign_up.html        # Registration page
│   ├── memoir_dashboard.html
│   ├── app.js              # Frontend JavaScript
│   └── styles.css          # Styling
├── .env                    # Environment variables (DO NOT COMMIT!)
├── .gitignore             # Git ignore rules
├── requirements.txt        # Python dependencies
├── run.py                 # Application launcher
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL (or SQLite for development)
- pip

### Installation

```bash
# 1. Navigate to project directory
cd Memoir

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Check setup
python setup_check.py

# 6. Run database migration (IMPORTANT - Run this ONCE)
python migrate_database.py

# 7. Verify .env configuration
# Your .env file is already configured with:
# - DB_URL (PostgreSQL connection)
# - SECRET_KEY (secure token)
# - ACCESS_TOKEN_EXPIRE_MINUTES
# - ALGORITHM
```

### First Time Setup (Important!)

**If you're upgrading from an older version or have existing database:**

```bash
# This will fix any schema issues
python migrate_database.py
```

This migration script will:
- Check your database schema
- Remove any incorrect columns (e.g., user_id from filestore)
- Ensure the schema matches the models
- Safe to run multiple times

### Running the Application

```bash
# Start the server
python run.py

# Server will start on http://localhost:8000
```

### Access Points

- **Frontend**: Serve the `frontend/` folder with any web server
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sign_up` | Register new user |
| POST | `/login` | Login and get JWT token |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/home/category` | Create category |
| GET | `/home/categories` | List all categories |
| DELETE | `/home/category/{id}` | Delete category |

### People
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/home/person` | Create person |
| GET | `/home/category/{id}/people` | List people in category |
| DELETE | `/home/person/{id}` | Delete person |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/home/person/{id}/upload` | Upload file |
| GET | `/home/person/{id}/files` | List files |
| GET | `/home/person/{id}/files/{file_id}/download` | **Download file** |
| DELETE | `/home/person/{id}/files/{file_id}` | Delete file |

### Structure
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/home/user/structure` | Get complete hierarchy |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information |
| GET | `/home` | Home page |
| GET | `/health` | Health check |

## 🔒 Security Features

1. **JWT Authentication** - Secure token-based authentication
2. **Password Hashing** - bcrypt with automatic salt generation
3. **Password Validation** - Minimum 8 characters, must contain letters and numbers
4. **Username Validation** - Alphanumeric only, prevents injection
5. **SQL Injection Protection** - Parameterized queries
6. **CORS Protection** - Configurable origins
7. **Token Expiration** - Automatic token invalidation
8. **File Type Validation** - Only allowed extensions
9. **File Size Limits** - Configurable max size (default 100MB)
10. **User Isolation** - Complete data separation

## 📦 Supported File Types

| Category | Extensions |
|----------|-----------|
| **Audio** | mp3, wav, flac, aac, m4a, ogg, opus, wma |
| **Video** | mp4, avi, mov, mkv, flv, wmv, webm, mpeg, mpg |
| **Image** | jpg, jpeg, png, gif, bmp, webp, svg, tiff, ico |
| **Document** | pdf, txt, doc, docx, xls, xlsx, ppt, pptx, odt, rtf |

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_URL` | Database connection string | **Required** |
| `SECRET_KEY` | JWT secret key | **Required** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | 30 |
| `ALGORITHM` | JWT algorithm | HS256 |
| `MAX_FILE_SIZE_MB` | Max file size in MB | 100 |
| `CORS_ORIGINS` | Allowed CORS origins | * |

### Database URL Format

```
# PostgreSQL
postgresql://user:password@localhost:5432/memoir

# SQLite (development only)
sqlite:///./memoir.db
```

## 🛠️ Tech Stack

- **Backend**: FastAPI 0.109.0
- **Database**: PostgreSQL / SQLite
- **ORM**: SQLAlchemy 2.0.25
- **Authentication**: JWT (python-jose)
- **Password Hashing**: bcrypt (passlib)
- **Validation**: Pydantic
- **Server**: Uvicorn
- **Frontend**: Vanilla JS, HTML5, CSS3

## 📊 Database Schema

```
users
├── id (PK)
├── name (unique)
├── password (hashed)
└── created_at

categories
├── id (PK)
├── cat_name
├── user_id (FK → users.id)
└── created_at

persons
├── id (PK)
├── person_name
├── category_id (FK → categories.id)
└── created_at

filestore
├── id (PK)
├── file_name
├── file_data (binary)
├── file_type
├── description
├── person_id (FK → persons.id)
└── created_at
```

## 🧪 Testing

```bash
# Test API endpoints
curl -X POST http://localhost:8000/sign_up \
  -H "Content-Type: application/json" \
  -d '{"name": "testuser", "password": "Test123456"}'

# Check health
curl http://localhost:8000/health
```

## 🐛 Troubleshooting

### "null value in column user_id of relation filestore"

This error means your database has an old schema. **Solution:**

```bash
# Run the migration script
python migrate_database.py
```

This will remove the incorrect `user_id` column from the `filestore` table.

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d memoir
```

### Import Errors
```bash
# Ensure virtual environment is activated
# Reinstall dependencies
pip install -r requirements.txt
```

### Port Already in Use
```bash
# Change port in run.py
# Or kill process on port 8000
# Windows: netstat -ano | findstr :8000
# Linux/Mac: lsof -ti:8000 | xargs kill
```

## 📝 Changelog

### Version 2.0.0 (February 2026)
- Complete refactor with all critical fixes
- Enhanced security and validation
- Improved database performance
- Added file download endpoint
- Better error handling
- Comprehensive documentation

### Version 1.0.0
- Initial release

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation at `/docs`
- Check application logs

## ⚠️ Security Notice

- **Never commit .env file**
- Change SECRET_KEY in production
- Use strong passwords
- Enable HTTPS in production
- Regularly update dependencies
- Monitor application logs
- Implement rate limiting for production
- Consider moving file storage to S3/cloud storage

## 🎯 Production Deployment

For production deployment:

1. Use PostgreSQL (not SQLite)
2. Set strong SECRET_KEY (32+ characters)
3. Configure proper CORS origins
4. Enable HTTPS
5. Set up reverse proxy (nginx)
6. Implement rate limiting
7. Set up monitoring and logging
8. Regular database backups
9. Use environment-specific configs
10. Consider cloud file storage

---

**Built with ❤️ for preserving memories**
**
