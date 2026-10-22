# AgentShield Frontend

Local dev:

```powershell
cd frontend
npm install
npm run dev
```

Build:

```powershell
cd frontend
npm run build
```

Environment variables (create `.env` in `frontend/`):

- `VITE_API_BASE` — e.g. `http://localhost:8000/api/v1`
- `VITE_API_WS_BASE` — e.g. `ws://localhost:8000/ws/agent`
