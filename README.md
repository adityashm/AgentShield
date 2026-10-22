# AgentShield AI — Quick Start Guide

AgentShield AI is a behaviour-based security monitoring system for autonomous AI agents.

## Architecture

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Chart.js (`frontend/`)
- **Backend:** FastAPI, SQLAlchemy, SQLite/PostgreSQL, Scikit-learn (Isolation Forest) (`backend/`)
- **Real-Time Layer:** WebSockets (`ws://localhost:8000/ws` and `ws://localhost:8000/ws/agent/{id}`)
- **ML Engine:** Unsupervised Isolation Forest Anomaly Detection (5-dimensional action feature vectors)
- **Rule Engine:** MITRE ATLAS threat categories (Prompt Injection, Unauthorized File Access, Privilege Escalation, API Rate Bursts, Data Exfiltration)

---

## 🚀 Running the System

### 1. Start the FastAPI Backend
Open a terminal in the root directory:
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Documentation (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)
- The backend automatically initializes `agentshield.db`, seeds the 6 security rules and agents, and begins generating live autonomous agent telemetry.

### 2. Start the Frontend Dashboard
Open a second terminal in the root directory:
```powershell
cd frontend
npm run dev
```
- Mission Control Dashboard: [http://localhost:5173](http://localhost:5173)
- Login Page: [http://localhost:5173/login](http://localhost:5173/login) (One-click "Analyst Demo" or "Admin Demo")

---

## 🎯 Testing Threat Injections

While the server is running, trigger targeted MITRE ATLAS attack scenarios using the standalone simulator:
```powershell
cd backend

# Inject adversarial prompt injection jailbreak
python simulator.py --scenario prompt_injection

# Inject unauthorized database credential query
python simulator.py --scenario db_privilege

# Inject privilege escalation (sudo / reverse shell)
python simulator.py --scenario sudo_escalation

# Inject API rate flooding
python simulator.py --scenario rate_flood

# Run continuous simulation loop
python simulator.py --continuous --interval 2.5
```
Watch the events trigger real-time Critical alerts on the React dashboard in milliseconds!

---

## 🧪 Running Automated Tests

Run backend unit and integration tests:
```powershell
cd backend
python -m pytest tests -v
```

Run frontend production build verification:
```powershell
cd frontend
npm run build
```
