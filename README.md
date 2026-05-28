# Linear Algebra AI Tutor

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An intelligent tutoring system for Linear Algebra built with FastAPI, React, and Claude AI. Designed for TSIW students at ESMAD - Escola Superior de Média Arte e Design.

> 🎓 **Educational AI Project** | 🤖 **Powered by Claude** | 📐 **Socratic Method Teaching**

## 🎯 Features

- **AI-Powered Tutoring**: Uses Claude (Anthropic) for intelligent, Socratic-method teaching
- **RAG System**: Retrieves relevant content from course materials to provide context-aware answers
- **LaTeX Rendering**: Full mathematical notation support with KaTeX
- **Conversation Management**: Save and resume learning sessions
- **Progress Tracking**: Monitor learning progress across topics
- **Interactive Interface**: Modern, responsive chat interface
- **Python Code Generation**: Get visualizations and examples in NumPy/Matplotlib

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript)               │
│  - Chat Interface with LaTeX rendering                  │
│  - Conversation history management                      │
│  - User authentication                                  │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                Backend (FastAPI)                         │
│  - REST API for chat, auth, problems                    │
│  - Session and conversation management                  │
│  - User progress tracking                               │
└─────┬────────────┬────────────────┬─────────────────────┘
      │            │                │
┌─────▼────┐  ┌───▼──────┐  ┌─────▼──────┐
│ Claude   │  │   RAG    │  │ PostgreSQL │
│   API    │  │  System  │  │            │
└──────────┘  └──────────┘  └────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional, for containerized deployment)
- Anthropic API key (get one at https://console.anthropic.com)

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/diogoribeiro7/linear-algebra-tutor.git
cd linear-algebra-tutor
```

2. **Backend Setup**
```bash
cd backend

# Install Poetry once (https://python-poetry.org/docs/#installation),
# then have it create an in-project venv and install everything:
poetry config virtualenvs.in-project true --local
poetry install --no-root --with test,dev

# Create .env file from template
cp ../.env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Initialize database
# The database will be automatically created on first run
```

3. **Frontend Setup**
```bash
cd frontend

# Activate the pinned Yarn version (one-time, ships with Node 20+)
corepack enable

# Install dependencies
yarn install --immutable

# Create .env file (optional, for custom API URL)
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env
```

4. **Prepare Course Materials (Important!)**
```bash
# Create materials directory
mkdir -p data/materials

# Add your Linear Algebra course materials
# Supported formats: .md, .py, .txt
# Example structure:
# data/materials/
#   chapter1_vectors.md
#   chapter2_matrices.md
#   examples/
#     vector_operations.py
```

5. **Generate Embeddings**
```bash
# From project root
cd backend && poetry run python ../scripts/generate_embeddings.py
```

6. **Run the Application**

**Terminal 1 - Backend:**
```bash
cd backend
poetry run python -m app.main
# Backend will run on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
yarn dev
# Frontend will run on http://localhost:5173
```

7. **Access the Application**
- Open http://localhost:5173
- Register a new account
- Start learning!

### Docker Deployment

For production deployment with Docker:

```bash
# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access the application at http://localhost

## 📚 Project Structure

```
linear-algebra-tutor/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   │   ├── auth.py        # Authentication
│   │   │   └── chat.py        # Chat endpoints
│   │   ├── core/              # Core functionality
│   │   │   ├── llm.py         # Claude integration
│   │   │   ├── rag.py         # RAG system
│   │   │   ├── prompts.py     # System prompts
│   │   │   └── security.py    # Auth & security
│   │   ├── models/            # Database models
│   │   ├── services/          # Business logic
│   │   │   └── tutor.py       # Main tutoring service
│   │   ├── db/                # Database setup
│   │   ├── config.py          # Configuration
│   │   └── main.py            # FastAPI app
│   ├── pyproject.toml
│   ├── poetry.lock
│   └── Dockerfile
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── MathRenderer.tsx
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── services/          # API client
│   │   │   └── api.ts
│   │   ├── store/             # State management
│   │   │   └── index.ts       # Zustand store
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── Dockerfile
├── data/                       # Data directory
│   ├── materials/             # Course materials (you add these)
│   └── embeddings/            # Generated embeddings
├── scripts/                    # Utility scripts
│   └── generate_embeddings.py
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Anthropic API
ANTHROPIC_API_KEY=your-key-here          # Required
CLAUDE_MODEL=claude-sonnet-4-20250514     # Model to use
MAX_TOKENS=4096                           # Max response length
TEMPERATURE=0.7                           # Response creativity (0-1)

# Database
DATABASE_URL=sqlite+aiosqlite:///./linalg_tutor.db  # SQLite for dev
# DATABASE_URL=postgresql+asyncpg://...              # PostgreSQL for prod

# Tutoring
MAX_CONVERSATION_HISTORY=10               # Messages to keep in context
USE_HINTS_MODE=true                       # Socratic method vs direct answers
```

### Adding Course Materials

The RAG system works best with well-structured materials:

1. **Markdown files** (.md) - Course notes, textbook chapters
2. **Python files** (.py) - Code examples, demonstrations
3. **Text files** (.txt) - Additional notes, references

**Example material:**
```markdown
# Chapter 1: Vectors

## Introduction
A vector is a mathematical object with magnitude and direction...

## Key Concepts
- Vector addition: $\vec{a} + \vec{b}$
- Scalar multiplication: $k\vec{a}$
- Dot product: $\vec{a} \cdot \vec{b} = |\vec{a}||\vec{b}|\cos\theta$

## Example in Python
```python
import numpy as np
a = np.array([1, 2, 3])
b = np.array([4, 5, 6])
dot_product = np.dot(a, b)
```
```

## 🎓 Usage Guide

### For Students

1. **Ask Questions**: The AI tutor uses the Socratic method - it guides you to discover answers rather than just telling you
2. **Request Visualizations**: Ask for Python code to visualize concepts
3. **Step-by-Step Solutions**: Get hints and guidance through problems
4. **Practice Problems**: Work through problems with AI assistance

### For Instructors

1. **Add Materials**: Place course materials in `data/materials/`
2. **Regenerate Embeddings**: Run `python scripts/generate_embeddings.py` after updating materials
3. **Monitor Progress**: Track student usage through the database
4. **Customize Prompts**: Edit `backend/app/core/prompts.py` to adjust teaching style

## 🔬 Technical Details

### Technologies Used

**Backend:**
- FastAPI - Modern Python web framework
- SQLAlchemy - ORM for database
- Anthropic SDK - Claude AI integration
- Sentence Transformers - Text embeddings
- Pydantic - Data validation

**Frontend:**
- React 18 - UI framework
- TypeScript - Type safety
- Vite - Build tool
- TailwindCSS - Styling
- TanStack Query - Data fetching
- Zustand - State management
- KaTeX - Math rendering
- React Markdown - Markdown rendering

**Infrastructure:**
- PostgreSQL - Production database
- Redis - Caching & rate limiting
- Docker - Containerization
- Nginx - Reverse proxy

### RAG System

The Retrieval-Augmented Generation system:
1. Splits course materials into chunks
2. Generates embeddings using sentence-transformers
3. Stores embeddings in memory (or Pinecone for production)
4. Retrieves relevant chunks for each query
5. Provides context to Claude for accurate, course-specific answers

### API Endpoints

```
POST   /api/v1/auth/register         - Register new user
POST   /api/v1/auth/login            - Login
GET    /api/v1/auth/me               - Get current user

GET    /api/v1/chat/conversations    - List conversations
POST   /api/v1/chat/conversations    - Create conversation
GET    /api/v1/chat/conversations/:id/messages  - Get messages
POST   /api/v1/chat/conversations/:id/messages  - Send message
```

## 🚀 Deployment

### Production Checklist

- [ ] Set strong `SECRET_KEY` in `.env`
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS with SSL certificates
- [ ] Set up proper CORS origins
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Back up database regularly
- [ ] Use Pinecone for scalable RAG (optional)

### Environment Variables for Production

```bash
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
SECRET_KEY=<generate-strong-random-key>
CORS_ORIGINS=["https://yourdomain.com"]
```

## 📝 Contributing

Contributions are welcome! This project is designed to showcase AI engineering skills.

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Diogo Ribeiro**
- ESMAD - Instituto Politécnico do Porto
- Email: dfr@esmad.ipp.pt
- GitHub: [@diogoribeiro7](https://github.com/diogoribeiro7)
- ORCID: [0009-0001-2022-7072](https://orcid.org/0009-0001-2022-7072)

## 🙏 Acknowledgments

- Built for TSIW program students at ESMAD
- Inspired by modern AI tutoring systems

---

**Note**: This project requires an Anthropic API key. Get one at https://console.anthropic.com
