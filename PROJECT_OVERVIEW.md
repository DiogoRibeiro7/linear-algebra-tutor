# Linear Algebra AI Tutor - Project Overview

## 🎯 Project Vision

An intelligent tutoring system that transforms how students learn Linear Algebra by combining:
- **AI-powered teaching** with Claude's advanced reasoning
- **Socratic method** for deep understanding, not just answers
- **RAG technology** to ground responses in course materials
- **Modern UX** with LaTeX rendering and conversational interface

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                           │
│                  (React + TypeScript)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Chat         │  │ LaTeX Math   │  │ Conversation  │    │
│  │ Interface    │  │ Rendering    │  │ History       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────┐
│                   Backend Services                           │
│                    (FastAPI)                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Auth &       │  │ Conversation │  │ Progress     │    │
│  │ Users        │  │ Management   │  │ Tracking     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Tutoring Engine                           │  │
│  │  ┌─────────────┐    ┌──────────────┐                │  │
│  │  │ RAG System  │───▶│ Claude API   │                │  │
│  │  │             │    │              │                │  │
│  │  │ • Course    │    │ • Socratic   │                │  │
│  │  │   Materials │    │   Method     │                │  │
│  │  │ • Embeddings│    │ • Step-by-   │                │  │
│  │  │ • Retrieval │    │   Step       │                │  │
│  │  └─────────────┘    └──────────────┘                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ PostgreSQL   │  │ Redis        │  │ Vector       │    │
│  │ (Users,      │  │ (Sessions,   │  │ Store        │    │
│  │  Convos,     │  │  Cache)      │  │ (Embeddings) │    │
│  │  Messages)   │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### Frontend Components
```
frontend/src/
├── App.tsx                      # Main app with routing
├── pages/
│   ├── Dashboard.tsx            # Main interface
│   ├── Login.tsx                # Authentication
│   └── Register.tsx             # User registration
├── components/
│   ├── ChatInterface.tsx        # Main chat UI
│   ├── MessageBubble.tsx        # Individual messages
│   └── MathRenderer.tsx         # LaTeX rendering
├── services/
│   └── api.ts                   # Backend API client
└── store/
    └── index.ts                 # Zustand state management
```

### Backend Services
```
backend/app/
├── main.py                      # FastAPI application
├── api/
│   ├── auth.py                  # Login, registration, JWT
│   └── chat.py                  # Chat endpoints
├── core/
│   ├── llm.py                   # Claude integration
│   ├── rag.py                   # Retrieval system
│   ├── prompts.py               # System prompts
│   └── security.py              # Auth helpers
├── services/
│   └── tutor.py                 # Main tutoring logic
└── models/
    └── __init__.py              # SQLAlchemy models
```

---

## 🔄 Request Flow Example

**User asks: "What is an eigenvector?"**

```
1. Frontend (ChatInterface.tsx)
   ↓ Sends message via API client
   
2. Backend API (chat.py)
   ↓ Validates auth, creates message record
   ↓ Calls TutorService
   
3. Tutoring Service (tutor.py)
   ↓ Retrieves conversation history
   ↓ Calls RAG system
   
4. RAG System (rag.py)
   ↓ Generates query embedding
   ↓ Searches vector store
   ↓ Returns relevant course material
   
5. Claude Integration (llm.py)
   ↓ Constructs prompt with:
   │   • System prompt (Socratic method)
   │   • Retrieved context
   │   • Conversation history
   │   • User question
   ↓ Calls Claude API
   
6. Claude AI
   ↓ Generates educational response
   ↓ Returns answer
   
7. Backend
   ↓ Saves response to database
   ↓ Returns to frontend
   
8. Frontend
   ↓ Renders with LaTeX
   ↓ Shows to user
```

---

## 🎓 Teaching Philosophy

### Socratic Method Implementation

**Traditional Tutoring:**
```
Student: "What is an eigenvector?"
Tutor: "An eigenvector is a non-zero vector that..."
```

**Our AI Tutor:**
```
Student: "What is an eigenvector?"
AI: "Great question! Let's think about this step by step.
     
     First, imagine you have a transformation that acts on 
     vectors. What happens to most vectors when you apply 
     this transformation?
     
     [Guides student to discover the answer]"
```

### Response Strategy
1. **Acknowledge** the question
2. **Guide** with questions
3. **Provide hints** when stuck
4. **Build** on student's understanding
5. **Celebrate** progress

---

## 🔐 Security Features

- **Authentication**: JWT tokens with expiration
- **Password Security**: bcrypt hashing
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Pydantic models
- **CORS**: Configured for frontend
- **SQL Injection**: Protected by ORM

---

## 📊 Data Flow

### User Registration
```
Form → Validation → Password Hash → Database → JWT Token → Session
```

### Conversation
```
Message → Auth Check → Save → RAG Retrieve → Claude → Save → Response
```

### Progress Tracking
```
Problem Attempt → Evaluate → Update Score → Recommend Next → Display
```

---

## 🚀 Deployment Options

### Development
```bash
./setup.sh
# Backend: python -m app.main
# Frontend: npm run dev
```

### Docker (Production)
```bash
docker-compose up -d
# All services orchestrated
# PostgreSQL + Redis + Backend + Frontend
```

### Cloud Platforms
- **Heroku**: Easy deployment with Procfile
- **Railway**: Built-in PostgreSQL
- **Fly.io**: Global edge deployment
- **AWS/GCP/Azure**: Full control, more setup

---

## 📈 Performance Considerations

### Backend
- **Async Operations**: Non-blocking LLM calls
- **Connection Pooling**: Database efficiency
- **Caching**: Redis for frequent queries
- **Rate Limiting**: Per-user quotas

### Frontend
- **Code Splitting**: Lazy-loaded routes
- **Memoization**: React.memo for expensive renders
- **Virtual Scrolling**: Long conversation lists
- **Debouncing**: Input fields

### RAG System
- **Pre-computed Embeddings**: Generate once
- **In-memory Search**: Fast retrieval
- **Batch Processing**: Efficient encoding
- **Cache Results**: Common queries

---

## 🎯 Key Metrics to Track

### User Engagement
- Daily/Weekly active users
- Average session duration
- Messages per conversation
- Return rate

### Learning Effectiveness
- Problems attempted vs solved
- Hint request frequency
- Topic mastery progression
- Time to understanding

### System Performance
- API response times
- LLM token usage
- RAG retrieval accuracy
- Error rates

### Cost Management
- Claude API usage
- Database queries
- Storage usage
- Infrastructure costs

---

## 🔮 Future Roadmap

### Phase 1: MVP ✅
- [x] Chat interface
- [x] User authentication
- [x] Claude integration
- [x] RAG system
- [x] LaTeX rendering

### Phase 2: Enhanced Learning
- [ ] Problem bank with auto-grading
- [ ] Code execution sandbox
- [ ] Visualization generation
- [ ] Progress dashboard
- [ ] Adaptive difficulty

### Phase 3: Scale & Polish
- [ ] Portuguese language support
- [ ] Voice input/output
- [ ] Mobile app (React Native)
- [ ] Instructor dashboard
- [ ] Analytics platform

### Phase 4: Research
- [ ] Learning analytics
- [ ] A/B testing framework
- [ ] Effectiveness studies
- [ ] Publication in EdTech journals

---

## 💡 Innovation Points

1. **RAG in Education**: Novel application of retrieval-augmented generation
2. **Socratic AI**: Teaching methodology encoded in prompts
3. **Full-Stack AI**: Complete production system, not just a demo
4. **Open Source**: Fully documented and reproducible
5. **Real Use Case**: Designed for actual TSIW students

---

## 📚 Learning Outcomes

### For Students
- Deeper understanding through guided discovery
- Practice at their own pace
- Immediate feedback
- Progress visibility
- Less intimidating than asking professor

### For Instructors
- Supplement traditional teaching
- 24/7 student support
- Usage analytics
- Common misconception identification
- More time for complex topics

---

## 🤝 Contributing

This project welcomes contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guidelines
- Testing requirements
- Pull request process
- Development setup

---

## 📄 License & Citation

**License:** MIT (see [LICENSE](LICENSE))

**Citation:** See [CITATION.cff](CITATION.cff)

```bibtex
@software{ribeiro2025linalg,
  author = {Ribeiro, Diogo},
  title = {Linear Algebra AI Tutor},
  year = {2025},
  url = {https://github.com/diogoribeiro7/linear-algebra-tutor}
}
```

---

**Built with ❤️ for education at ESMAD**
