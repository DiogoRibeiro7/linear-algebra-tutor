# 🎬 Demo Presentation Script

## For Showcasing Linear Algebra AI Tutor

This script helps you demonstrate the project effectively to students, colleagues, or for portfolio reviews.

---

## 🎯 Demo Flow (10-15 minutes)

### 1. Introduction (2 min)

**Opening:**
> "Today I'm showing you an AI-powered tutoring system I built for Linear Algebra education. It combines Claude AI with a technique called RAG - Retrieval-Augmented Generation - to provide personalized, Socratic-method teaching."

**Key Points to Mention:**
- Built for TSIW students at ESMAD
- Uses modern full-stack architecture
- Production-ready with Docker deployment
- Open source on GitHub

**Tech Stack Slide:**
- Frontend: React + TypeScript + TailwindCSS
- Backend: FastAPI + Claude AI + RAG
- Database: PostgreSQL + Redis
- Infrastructure: Docker + Nginx

---

### 2. Architecture Overview (3 min)

**Show the Architecture Diagram:**
(From PROJECT_OVERVIEW.md)

**Explain the Flow:**
> "When a student asks a question, here's what happens:
> 1. The React frontend sends the message to our FastAPI backend
> 2. The RAG system searches through our course materials
> 3. Relevant context is retrieved and sent to Claude
> 4. Claude generates an educational response using the Socratic method
> 5. The response is rendered with LaTeX math formatting"

**Highlight:**
- Async Python for non-blocking LLM calls
- Vector embeddings for semantic search
- JWT authentication for security
- Real-time chat with conversation history

---

### 3. Live Demo (5 min)

**Step 1: Show Login/Registration**
- Navigate to http://localhost:5173
- Quick registration demo
- Explain: "Secure authentication with JWT tokens and bcrypt password hashing"

**Step 2: Start a Conversation**

**Demo Question 1 - Basic Concept:**
```
Student: "What is a vector?"
```

**What to Highlight:**
- Socratic response (doesn't just give definition)
- LaTeX rendering (mathematical notation)
- Source attribution (shows which materials were used)

**Demo Question 2 - Problem Solving:**
```
Student: "How do I calculate the dot product of two vectors?"
```

**What to Highlight:**
- Step-by-step guidance
- Asks leading questions
- Provides hints, not direct answers

**Demo Question 3 - Code Generation:**
```
Student: "Can you show me how to visualize a 2D linear transformation in Python?"
```

**What to Highlight:**
- Generates Python code with NumPy/Matplotlib
- Includes comments and explanations
- Educational code, not just functional

---

### 4. RAG System Demo (2 min)

**Show Behind the Scenes:**

```bash
# Open terminal and show the embeddings generation
python scripts/generate_embeddings.py
```

**Explain:**
> "The RAG system works by:
> 1. Converting course materials into vector embeddings
> 2. When a question comes in, it's also converted to a vector
> 3. We find the most similar course materials
> 4. That context is provided to Claude for grounding the response
> 
> This ensures answers are based on actual course content, not hallucinated."

**Show the Materials:**
```bash
ls data/materials/
cat data/materials/chapter1_vectors.md | head -20
```

---

### 5. Technical Deep Dive (Optional - 3 min)

**For Technical Audiences:**

**Show the Code:**
```bash
# Backend - Claude integration
cat backend/app/core/llm.py | grep -A 20 "def generate_response"

# Frontend - Chat interface
cat frontend/src/components/ChatInterface.tsx | grep -A 15 "function ChatInterface"
```

**Highlight:**
- Async/await patterns in Python
- React hooks (useState, useEffect)
- TypeScript for type safety
- Zustand for state management
- TanStack Query for data fetching

**Show the Prompts:**
```bash
cat backend/app/core/prompts.py
```

**Explain:**
> "The Socratic method is encoded in these prompts. We explicitly tell Claude to guide students rather than just provide answers."

---

### 6. Deployment Demo (2 min)

**Docker Compose:**
```bash
# Show the docker-compose.yml
cat docker-compose.yml

# Start all services
docker-compose up -d

# Show running containers
docker ps
```

**Explain:**
> "Production deployment is fully automated:
> - PostgreSQL for data persistence
> - Redis for caching and sessions
> - Nginx as reverse proxy
> - Backend and frontend in separate containers
> - One command to deploy everything"

---

### 7. Future Roadmap (1 min)

**What's Next:**
- Problem bank with auto-grading
- Code execution sandbox (safe Python REPL)
- Progress analytics dashboard
- Portuguese language support
- Mobile app version
- Instructor dashboard

---

## 💡 Key Talking Points

### For Students:
- "Available 24/7 for help with Linear Algebra"
- "Uses Socratic method to help you discover answers"
- "References actual course materials"
- "Shows work with LaTeX rendering"

### For Faculty:
- "Supplements traditional teaching"
- "Provides usage analytics"
- "Can be customized with your materials"
- "Open source and extensible"

### For Developers:
- "Modern full-stack architecture"
- "Production-ready with CI/CD"
- "Comprehensive test coverage ready"
- "Well-documented and maintainable"

### For Portfolio Reviews:
- "Demonstrates AI engineering skills"
- "Full-stack development proficiency"
- "System design capabilities"
- "Production deployment experience"
- "Open source contribution"

---

## 🎥 Screen Recording Tips

### Tools:
- **Mac:** QuickTime, ScreenFlow
- **Windows:** OBS Studio, Camtasia
- **Linux:** OBS Studio, SimpleScreenRecorder
- **Cross-platform:** Loom

### Recording Checklist:
- [ ] Clean browser (close extra tabs)
- [ ] Hide personal information
- [ ] Maximize window for visibility
- [ ] Prepare test account credentials
- [ ] Have demo questions ready
- [ ] Test audio before recording
- [ ] Record in 1080p minimum

### Demo Tips:
- Slow down - explain as you go
- Use cursor highlights
- Pause after each feature
- Show errors and how to fix them
- End with GitHub repository tour

---

## 📊 Metrics to Share

**Project Stats:**
- 4,844 lines of code
- 55 files
- Full-stack application
- Production-ready

**Features:**
- User authentication
- Conversation management
- RAG system
- LaTeX rendering
- Docker deployment
- CI/CD pipeline

**Technologies:**
- 2 languages (Python, TypeScript)
- 5 frameworks (FastAPI, React, SQLAlchemy, etc.)
- 3 databases (PostgreSQL, SQLite, Redis)
- Docker containerization

---

## 🎤 Q&A Preparation

### Common Questions:

**Q: How accurate is the AI?**
A: "Claude is one of the best LLMs available, and by using RAG to ground responses in course materials, we ensure accuracy. The system references specific course content rather than generating from memory."

**Q: Can students get direct answers?**
A: "The system is designed for learning, not cheating. It uses the Socratic method - asking guiding questions and providing hints. Direct solutions are only given after the student has worked through the problem."

**Q: How much does it cost to run?**
A: "Main cost is the Claude API. For development it's pennies per query. For production with many students, we'd optimize with caching and efficient prompting. Estimated $50-100/month for a class of 30 students."

**Q: Can other subjects use this?**
A: "Absolutely! The architecture is subject-agnostic. You'd swap out the course materials, adjust the prompts, and it works for any technical subject. Could do Calculus, Physics, Chemistry, etc."

**Q: What about data privacy?**
A: "All student data is encrypted. Conversations are private to each user. We use JWT tokens with expiration. No data is shared with third parties beyond the AI API calls, which are also protected."

**Q: How long did this take to build?**
A: "The initial version took about [your timeframe]. But it's built on modern frameworks and best practices, making it maintainable and extensible."

---

## 📝 Demo Checklist

Before presenting:
- [ ] Backend running (http://localhost:8000)
- [ ] Frontend running (http://localhost:5173)
- [ ] Test account created
- [ ] Sample questions prepared
- [ ] Course materials loaded
- [ ] Embeddings generated
- [ ] GitHub repository public
- [ ] Documentation updated
- [ ] Screenshots ready
- [ ] Network/internet working

During presentation:
- [ ] Speak clearly and not too fast
- [ ] Explain technical terms
- [ ] Show code when relevant
- [ ] Demonstrate actual functionality
- [ ] Handle errors gracefully
- [ ] Engage with questions
- [ ] Provide GitHub link

After presenting:
- [ ] Share GitHub repository link
- [ ] Share documentation
- [ ] Offer to demo one-on-one
- [ ] Collect feedback
- [ ] Follow up with interested parties

---

## 🔗 Resources to Share

**GitHub Repository:**
https://github.com/diogoribeiro7/linear-algebra-tutor

**Documentation:**
- README.md - Quick start
- DEVELOPMENT.md - Technical details
- PROJECT_OVERVIEW.md - Architecture

**Contact:**
- Email: dfr@esmad.ipp.pt
- GitHub: @diogoribeiro7
- ORCID: 0009-0001-2022-7072

---

**Good luck with your demo! You've built something impressive.** 🚀
