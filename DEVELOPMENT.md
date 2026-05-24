# Linear Algebra AI Tutor - Development Guide

## Project Overview

This is a production-ready AI tutoring system showcasing modern AI engineering practices. Built for TSIW students at ESMAD, it demonstrates:

- **Full-stack AI application development**
- **RAG (Retrieval-Augmented Generation) implementation**
- **Modern web architecture with React + FastAPI**
- **Production deployment with Docker**
- **Real-world AI product engineering**

## Core Technologies

### Backend Stack
- **FastAPI**: Modern async Python web framework
- **Claude (Anthropic)**: State-of-the-art LLM for tutoring
- **RAG System**: Custom implementation with sentence-transformers
- **SQLAlchemy**: ORM for database operations
- **PostgreSQL/SQLite**: Database layer
- **Redis**: Caching and session management
- **Pydantic**: Data validation and settings management

### Frontend Stack
- **React 18**: UI framework with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first styling
- **TanStack Query**: Powerful data fetching and caching
- **Zustand**: Lightweight state management
- **KaTeX**: LaTeX math rendering
- **React Markdown**: Markdown parsing with plugins

## Architecture Patterns

### 1. RAG Pipeline
```
Query → Embedding → Vector Search → Context Retrieval → LLM + Context → Response
```

**Implementation:**
- Sentence transformers for embeddings
- NumPy for similarity search
- Chunk-based document processing
- Context injection into Claude prompts

### 2. Conversation Management
```
User → API → Session → History → Claude → Response → DB → User
```

**Key Features:**
- Persistent conversation history
- Context window management
- Session-based authentication
- Message metadata tracking

### 3. Socratic Teaching Method
```
Question → Analyze Intent → Provide Hint/Guide → Follow-up → Solution Discovery
```

**Prompt Engineering:**
- Custom system prompts for teaching behavior
- Context-aware hint generation
- Step-by-step solution guidance
- Encouragement and feedback

## Key Design Decisions

### Why FastAPI?
- Async support for LLM calls
- Auto-generated API documentation
- Type hints and validation
- Modern Python features

### Why Claude?
- Excellent at educational interactions
- Strong mathematical reasoning
- Good at following system prompts
- Socratic method capabilities

### Why Local RAG (not Pinecone)?
- Lower cost for development
- No external dependencies
- Full control over retrieval
- Easy to understand and debug
- Can migrate to Pinecone for production

### Why Zustand over Redux?
- Simpler API
- Less boilerplate
- Better TypeScript support
- Smaller bundle size

## Development Workflow

### Adding New Features

1. **Backend Feature:**
   ```
   1. Define Pydantic models (data validation)
   2. Create database models (if needed)
   3. Implement business logic in services/
   4. Add API endpoints in api/
   5. Write tests
   ```

2. **Frontend Feature:**
   ```
   1. Create types in types/
   2. Add API calls in services/api.ts
   3. Update store if needed
   4. Build components
   5. Add routes if needed
   ```

### Testing Strategy

**Backend:**
- Unit tests for services
- Integration tests for API endpoints
- Mock Claude API in tests
- Database fixtures for testing

**Frontend:**
- Component testing with React Testing Library
- Integration tests with MSW (Mock Service Worker)
- E2E tests with Playwright (optional)

### Code Quality

**Backend:**
- Type hints everywhere
- Black for formatting
- Ruff for linting
- MyPy for type checking

**Frontend:**
- TypeScript strict mode
- ESLint for linting
- Prettier for formatting

## Deployment Strategies

### Development
```bash
# Backend: SQLite + local RAG
# Frontend: Vite dev server
# Quick iteration, hot reload
```

### Staging
```bash
# Docker Compose with PostgreSQL
# Production-like environment
# Testing deployment process
```

### Production
```bash
# Kubernetes or Docker Swarm
# PostgreSQL cluster
# Redis cluster
# Load balancer
# SSL/TLS termination
# Monitoring and logging
```

## Performance Considerations

### Backend
- Async LLM calls (non-blocking)
- Redis caching for frequent queries
- Database connection pooling
- Rate limiting per user
- Batch processing for embeddings

### Frontend
- Code splitting with React.lazy()
- Image optimization
- Lazy loading for conversations
- Debounced search inputs
- Virtual scrolling for long lists

### RAG System
- Pre-computed embeddings (not on-demand)
- In-memory vector search (fast)
- Chunk size optimization
- Top-k retrieval tuning

## Security Best Practices

1. **Authentication:**
   - JWT tokens with expiration
   - Secure password hashing (bcrypt)
   - HTTPS only in production

2. **API Security:**
   - Rate limiting
   - Input validation (Pydantic)
   - CORS configuration
   - SQL injection prevention (ORM)

3. **Data Privacy:**
   - User data isolation
   - Conversation encryption option
   - GDPR compliance ready
   - API key management

## Monitoring and Observability

### Metrics to Track
- API response times
- LLM token usage
- Error rates
- User engagement
- Conversation length
- RAG retrieval accuracy

### Logging
- Structured logging (JSON)
- Log levels (DEBUG, INFO, ERROR)
- Request/response logging
- Error tracking with stack traces

### Tools
- Prometheus for metrics
- Grafana for visualization
- Sentry for error tracking
- ELK stack for log aggregation

## Scaling Considerations

### Horizontal Scaling
- Stateless backend (can run multiple instances)
- Session storage in Redis (shared state)
- Load balancer distribution
- Database read replicas

### Vertical Scaling
- Optimize embedding model size
- GPU acceleration for embeddings
- Database query optimization
- Caching strategy

### Cost Optimization
- Cache frequent queries
- Batch LLM requests
- Compress embeddings
- Efficient prompt engineering (fewer tokens)

## Future Enhancements

### Phase 1 (Current MVP)
- ✅ Chat interface with LaTeX
- ✅ RAG system
- ✅ User authentication
- ✅ Conversation history

### Phase 2 (Next Steps)
- [ ] Problem bank with difficulty levels
- [ ] Progress tracking dashboard
- [ ] Code execution sandbox
- [ ] Visualization generation
- [ ] Personalized recommendations

### Phase 3 (Advanced)
- [ ] Multi-language support (Portuguese + English)
- [ ] Voice input/output
- [ ] Mobile app (React Native)
- [ ] Instructor dashboard
- [ ] A/B testing framework
- [ ] Analytics and insights

## Learning Resources

### AI Engineering
- RAG implementation patterns
- Prompt engineering best practices
- LLM integration patterns
- Vector database usage

### Full Stack
- FastAPI documentation
- React best practices
- TypeScript patterns
- Async Python

### Production
- Docker containerization
- CI/CD pipelines
- Monitoring and logging
- Security hardening

## Contributing

When contributing to this project:

1. Follow existing code structure
2. Write tests for new features
3. Update documentation
4. Use type hints (Python) or TypeScript
5. Follow commit message conventions
6. Create feature branches
7. Submit PRs with clear descriptions

## Troubleshooting

### Common Issues

**"ModuleNotFoundError"**
- Activate virtual environment
- Run `pip install -r requirements.txt`

**"ANTHROPIC_API_KEY not set"**
- Create .env file from .env.example
- Add your API key

**"No embeddings found"**
- Run `python scripts/generate_embeddings.py`
- Check data/materials/ has content

**"Port already in use"**
- Change port in backend (8000) or frontend (5173)
- Kill process using the port

**Frontend build fails**
- Delete `node_modules` and `yarn.lock`
- Run `yarn install` again
- Check Node.js version (need 20+)

## Contact

For questions about this project:
- Diogo Ribeiro - dfr@esmad.ipp.pt
- GitHub: @diogoribeiro7
