# 🛡️ ExamGuard

**ExamGuard** is a high-performance, AI-powered exam management and proctoring system designed to provide a secure and seamless examination experience for both students and administrators.

Built with a modern tech stack and optimized for hybrid deployment, ExamGuard ensures integrity through real-time AI proctoring and a robust centralized dashboard.

---

## 🚀 Features

- **🤖 AI Proctoring**: Integrated `face-api.js` for real-time identity verification and behavior monitoring.
- **📊 Admin Dashboard**: Comprehensive management interface for branches, students, and exam schedules.
- **⚡ Real-time Updates**: Instant sync between frontend and backend via Supabase.
- **🔒 Secure Architecture**: Robust authentication and data encryption.
- **📱 Responsive Design**: Fully optimized for desktop and tablet exam environments.
- **📈 Scalability**: Designed to handle 250+ concurrent students with low latency.

---

## 🛠️ Tech Stack & Languages

### 🌍 Languages
- **TypeScript**: Frontend logic & Type safety.
- **Python**: Backend API & Data processing.
- **SQL**: Database schema & Migrations.
- **CSS**: Premium styling & Animations.
- **Markdown**: Project documentation.

### 🌐 Frontend
- **Framework**: [Next.js 16](https://nextjs.org) (React 19)
- **Styling**: Vanilla CSS & [Framer Motion](https://www.framer.com/motion/)
- **AI/ML**: [Face-API.js](https://github.com/justadudewhohacks/face-api.js/) for proctoring.
- **Auth**: Supabase SSR Auth.

### 🐍 Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **ORM/DB**: Supabase (PostgreSQL)
- **Security**: JWT, CORS Middleware, & Environment encryption.

### 🏗️ Infrastructure
- **Containerization**: Docker (via `Dockerfile`)
- **Deployment**: Vercel (Frontend) & Railway/Render (Backend)
- **CI/CD**: GitHub Actions (Configurable)

---

## 📂 Project Structure

```text
├── app/                   # Next.js App Router (Frontend logic)
│   ├── admin/             # Administrator dashboard (Exams/Students)
│   ├── exam/              # Main examination interface (Proctored)
│   ├── login/             # Secure authentication portal
│   └── instructions/      # Pre-exam guidelines
├── python_api/            # FastAPI Backend
│   ├── core/              # Security & Middleware
│   ├── models/            # Data validation schemas
│   ├── routers/           # API endpoints (Auth/Exams)
│   └── index.py           # API entry point
├── supabase/              # Database management
│   ├── schema.sql         # Table definitions
│   ├── seed.sql           # Initial questions & data
│   └── migrations/        # Database version control
├── components/            # Reusable UI components
│   ├── FaceMonitor.tsx    # AI Real-time Proctoring
│   ├── AntiCheat.tsx      # Window activity tracking
│   └── ExamTimer.tsx      # Syncronized countdowns
├── lib/                   # Shared utilities & API clients
├── public/                # Static assets (Images/Icons)
└── DEPLOYMENT.md          # Step-by-step deployment guide
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Supabase Account

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/meetukani34-prog/EXAM.git
   cd EXAM
   ```

2. **Frontend Setup**
   ```bash
   npm install
   cp .env.example .env.local
   # Fill in your Supabase & API credentials
   npm run dev
   ```

3. **Backend Setup**
   ```bash
   cd python_api
   pip install -r requirements.txt
   uvicorn index:app --reload
   ```

---

## 🚢 Deployment

Detailed deployment steps for **Railway** (Backend) and **Vercel** (Frontend) can be found in the [DEPLOYMENT.md](file:///c:/EXAM/DEPLOYMENT.md) guide.

---

## 📝 License

This project is licensed under the MIT License.

---

Developed with ❤️ for secure education.