# Quick Reference Card

## 🚀 Quick Start Commands

### First Time Setup
```bash
./setup.sh                          # Run automated setup
cp .env.example .env                # Create environment file
# Edit .env and add ANTHROPIC_API_KEY
python scripts/generate_embeddings.py  # Generate embeddings
```

### Development

**Start Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m app.main
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Docker Deployment
```bash
docker-compose up -d        # Start all services
docker-compose logs -f      # View logs
docker-compose down         # Stop services
```

## 📁 Key Files

### Configuration
- `.env` - Environment variables (create from .env.example)
- `backend/app/config.py` - Application settings
- `frontend/vite.config.ts` - Frontend build config

### Backend Core
- `backend/app/main.py` - FastAPI application
- `backend/app/core/llm.py` - Claude integration
- `backend/app/core/rag.py` - RAG system
- `backend/app/core/prompts.py` - System prompts
- `backend/app/services/tutor.py` - Main tutoring logic

### Frontend Core
- `frontend/src/App.tsx` - Main application
- `frontend/src/pages/Dashboard.tsx` - Main interface
- `frontend/src/components/ChatInterface.tsx` - Chat UI
- `frontend/src/services/api.ts` - Backend API client
- `frontend/src/store/index.ts` - State management

### Data
- `data/materials/` - Add your course materials here (.md, .py, .txt)
- `data/embeddings/` - Generated embeddings (auto-created)

## 🛠️ Common Tasks

### Add Course Materials
```bash
# Add files to data/materials/
cp your-materials.md data/materials/

# Regenerate embeddings
python scripts/generate_embeddings.py
```

### Database Operations
```bash
# Reset database
rm backend/linalg_tutor.db
# Restart backend - will auto-create

# For PostgreSQL (Docker)
docker-compose exec db psql -U linalg -d linalg_tutor
```

### Run Tests
```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Check Logs
```bash
# Docker logs
docker-compose logs backend
docker-compose logs frontend

# Development
# Backend logs appear in terminal
# Frontend logs in browser console
```

## 🎯 API Endpoints

### Authentication
```
POST /api/v1/auth/register    # Register new user
POST /api/v1/auth/login       # Login
GET  /api/v1/auth/me          # Get current user
```

### Chat
```
POST /api/v1/chat/conversations                 # Create conversation
GET  /api/v1/chat/conversations                 # List conversations
GET  /api/v1/chat/conversations/:id/messages    # Get messages
POST /api/v1/chat/conversations/:id/messages    # Send message
```

## 🐛 Troubleshooting

### Backend won't start
1. Check Python version: `python --version` (need 3.11+)
2. Activate virtual environment
3. Install dependencies: `pip install -r requirements.txt`
4. Check .env file exists and has ANTHROPIC_API_KEY

### Frontend won't start
1. Check Node version: `node --version` (need 20+)
2. Delete node_modules: `rm -rf node_modules package-lock.json`
3. Reinstall: `npm install`

### "No embeddings found" error
1. Add materials to `data/materials/`
2. Run: `python scripts/generate_embeddings.py`

### Can't connect to backend
1. Check backend is running on port 8000
2. Check CORS settings in backend/app/config.py
3. Check frontend proxy in vite.config.ts

## 💡 Tips

### Better Responses
- Add more course materials to `data/materials/`
- Organize by topic (vectors, matrices, etc.)
- Include both theory and examples
- Add Python code examples

### Customize Teaching Style
- Edit `backend/app/core/prompts.py`
- Adjust `USE_HINTS_MODE` in .env
- Modify `TEMPERATURE` for response creativity

### Performance
- Generate embeddings once, reuse
- Use Redis for caching in production
- Batch similar queries
- Monitor token usage

## 📚 Documentation

- `README.md` - Main documentation
- `DEVELOPMENT.md` - Development guide
- API Docs: http://localhost:8000/docs (when running)
- Frontend: http://localhost:8000/redoc (alternative API docs)

## 🤝 Getting Help

1. Check README.md and DEVELOPMENT.md
2. Review code comments
3. Check API documentation at /docs
4. Contact: dfr@esmad.ipp.pt
