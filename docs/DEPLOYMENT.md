# AgentShield AI — Production Deployment Runbook

> **Target Architecture**: Docker Compose (Single-Host Production) or Kubernetes  
> **Default Port**: 8080 (Public Gateway) / 8000 (Internal Ingestion API)  
> **Database**: PostgreSQL 16 (Relational + JSONB)  

---

## 1. Architecture Overview

In production, AgentShield runs as a decoupled 3-tier container stack:

```
[ External AI Agents & Browsers ]
                 │
                 ▼  Port 8080 (HTTPS/HTTP)
      ┌───────────────────────┐
      │      web (Nginx)      │
      │   - Static SPA assets │
      │   - /api/ -> api:8000 │
      │   - /ws   -> api:8000 │
      └──────────┬────────────┘
                 │
                 ▼  Port 8000 (Internal Network)
      ┌───────────────────────┐
      │     api (FastAPI)     │
      │   - Detection Pipeline│
      │   - Outbox Worker     │
      │   - Event Bus         │
      └──────────┬────────────┘
                 │
                 ▼  Port 5432 (Internal Network)
      ┌───────────────────────┐
      │     db (PostgreSQL)   │
      │   - Multi-tenant data │
      │   - Audit Hash Chain  │
      └───────────────────────┘
```

---

## 2. Quickstart Deployment (Under 5 Minutes)

### Step 1: Clone Repository & Configure Environment
```bash
git clone https://github.com/adityashm/agentshield.git
cd agentshield

# Copy example environment configuration
cp .env.example .env
```

### Step 2: Generate Production Cryptographic Keys
Generate high-entropy secrets for your `.env` file:
```bash
# Generate JWT Secret
python -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"

# Generate API Key Pepper
python -c "import secrets; print('API_KEY_PEPPER=' + secrets.token_hex(32))"

# Generate Fernet Webhook Encryption Key (32 bytes urlsafe base64)
python -c "from cryptography.fernet import Fernet; print('SECRETS_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

### Step 3: Launch Production Containers
```bash
# Build and start services in the background
docker compose up --build -d

# Verify container status
docker compose ps
```

The stack is now fully operational:
- **Mission Control Dashboard**: `http://localhost:8080`
- **Default Admin Account**: `admin@agentshield.ai` / `AdminPass123!`
- **Pre-Seeded Demo API Key**: `ashield_test_default_demo_key_12345`

---

## 3. Environment Variable Reference

| Variable | Description | Required | Default |
|---|---|---|---|
| `ENVIRONMENT` | Runtime mode: `production` or `dev` | Yes | `production` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://agentshield:...@db:5432/agentshield` |
| `JWT_SECRET` | 256-bit secret for user session tokens | Yes | None (Must generate) |
| `API_KEY_PEPPER` | HMAC-SHA256 pepper for API key hashing | Yes | None (Must generate) |
| `SECRETS_ENCRYPTION_KEY` | Fernet key for encrypting webhook secrets | Yes | None (Must generate) |
| `RUN_WORKER_INLINE` | Run webhook outbox worker inside API process | No | `true` |
| `RATE_LIMIT_PER_KEY_PER_MIN`| Sliding window rate limit per API key | No | `600` |
| `ALERT_RISK_THRESHOLD` | Minimum risk score to trigger alert | No | `70.0` |
| `PORT` | Public port mapped to Nginx reverse proxy | No | `8080` |

---

## 4. Running the Autonomous Simulator Demo

To verify full end-to-end operation with continuous agent activity and targeted attack scenario injections:

```bash
# Launch the stack with the demo profile enabled
docker compose --profile demo up --build -d

# View live simulator telemetry logs
docker compose logs -f simulator
```

The simulator continuously streams realistic benign agent operations (heartbeats, file reads, data syncs) and injects targeted OWASP/MITRE attack scenarios every few actions, lighting up the Mission Control charts and triggering alerts in real time.

---

## 5. Database Migrations & Seeding Runbook

Database migrations execute automatically at container startup via `entrypoint.sh`. To manually manage migrations:

```bash
# Run latest migrations
docker compose exec api alembic upgrade head

# Check current migration version
docker compose exec api alembic current

# Re-seed demo agents and baseline actions
docker compose exec api python scripts/seed_demo.py
```

---

## 6. SSL / TLS Termination

For public internet deployments, configure SSL/TLS in `deploy/nginx/nginx.conf` or terminate TLS at a cloud load balancer (AWS ALB, Cloudflare, Traefik).

Example Nginx TLS configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name agentshield.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/agentshield/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agentshield/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... remaining location blocks from deploy/nginx/nginx.conf ...
}
```

---

## 7. Backup & Disaster Recovery

### Automated PostgreSQL Backup
```bash
# Create timestamped database backup
docker compose exec -t db pg_dump -U agentshield agentshield | gzip > "backup_agentshield_$(date +%Y%m%d_%H%M%S).sql.gz"

# Restore database from backup
gunzip < backup_agentshield_20261022_120000.sql.gz | docker compose exec -T db psql -U agentshield -d agentshield
```

---

## 8. Health Checks & Diagnostics

### Infrastructure Health Check
```bash
curl -f http://localhost:8080/api/v1/system/health
```
Expected response:
```json
{
  "status": "operational",
  "active_agents_count": 6,
  "database_connected": true,
  "isolation_forest_ready": true
}
```

### Pre-Flight Evaluation Benchmark
Run the load tester to verify pre-flight latency budget ($p95 < 50\text{ms}$):
```bash
python scripts/loadtest.py --url http://localhost:8080 --requests 200 --concurrency 10 --strict
```
