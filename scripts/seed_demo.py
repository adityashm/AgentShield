"""
AgentShield AI — Demo Environment & Agent Seeder
Seeds reproducible demo organization, admin credentials, API keys, simulated agents,
and baseline operational actions into the database.

Usage:
    python scripts/seed_demo.py
    python scripts/seed_demo.py --api-url http://localhost:8000
    python scripts/seed_demo.py --direct-db
"""

import sys
import os
import argparse
import random
import uuid
from datetime import datetime, timezone, timedelta

# Ensure repo root and backend are in PYTHONPATH
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

def seed_via_direct_db():
    print("[SEED: DB] Connecting to database via SQLAlchemy...")
    from app.database import engine, Base, SessionLocal
    from app.db.models import Organization, User, APIKey, Agent, Action, Rule
    from app.services.auth import seed_default_org_and_key
    from app.core.security import hash_password
    from app.services.rule_engine import RuleEngine
    from app.simulator.scenarios import SIMULATED_AGENTS, NORMAL_ACTIONS

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed rules & default org/key
        RuleEngine.seed_default_rules(db)
        seed_default_org_and_key(db)

        org = db.query(Organization).filter(Organization.id == "org_default").first()
        if not org:
            org = Organization(
                id="org_default",
                name="AgentShield Demo Corp",
                slug="agentshield-demo",
                plan="enterprise",
            )
            db.add(org)
            db.commit()

        # 2. Seed Simulated Agents
        print(f"[SEED: DB] Seeding {len(SIMULATED_AGENTS)} simulated agents...")
        now = datetime.now(timezone.utc)
        agents_created = 0
        for ag in SIMULATED_AGENTS:
            existing = (
                db.query(Agent)
                .filter(Agent.external_id == ag["id"], Agent.org_id == org.id)
                .first()
            )
            if not existing:
                agent = Agent(
                    id=f"{org.id}_{ag['id']}",
                    external_id=ag["id"],
                    name=ag["name"],
                    org_id=org.id,
                    framework=ag.get("framework", "custom"),
                    environment="production",
                    status="active",
                    risk_score=random.uniform(8.0, 22.0),
                    first_seen=now - timedelta(hours=random.randint(12, 72)),
                    last_seen=now,
                    is_synthetic=True,
                    metadata_json={
                        "role": ag.get("role", "Worker"),
                        "type": ag.get("type", "Autonomous Agent"),
                    },
                )
                db.add(agent)
                agents_created += 1
        db.commit()
        print(f"[SEED: DB] Created {agents_created} new agents.")

        # 3. Seed Baseline Actions for Charts
        action_count = db.query(Action).filter(Action.org_id == org.id).count()
        if action_count < 10:
            print("[SEED: DB] Seeding baseline telemetry actions for Mission Control charts...")
            import json
            for i in range(25):
                ag_info = random.choice(SIMULATED_AGENTS)
                act_info = random.choice(NORMAL_ACTIONS)
                act_time = now - timedelta(minutes=(25 - i) * 6)
                action = Action(
                    id=str(uuid.uuid4()),
                    org_id=org.id,
                    agent_id=f"{org.id}_{ag_info['id']}",
                    action_type=act_info["action_type"],
                    parameters_json=json.dumps(act_info["parameters"]),
                    timestamp=act_time,
                    risk_score=random.uniform(5.0, 30.0),
                    anomaly_score=random.uniform(0.05, 0.25),
                )
                db.add(action)
            db.commit()
            print("[SEED: DB] Seeded 25 historical baseline actions.")

        print("\n[SUCCESS] Direct database seeding complete!")
        print("  Organization: AgentShield Demo Corp (ID: org_default)")
        print("  Admin User:   admin@agentshield.ai (Password: AdminPass123!)")
        print("  Demo API Key: ashield_test_default_demo_key_12345")
        return True

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        return False
    finally:
        db.close()

def seed_via_http(api_url: str):
    print(f"[SEED: HTTP] Contacting AgentShield API at {api_url}...")
    import requests
    seed_url = f"{api_url.rstrip('/')}/api/v1/demo/seed"
    try:
        r = requests.post(seed_url, timeout=10)
        if r.status_code == 200:
            res = r.json()
            print(f"[SUCCESS] {res.get('message', 'Demo environment seeded successfully.')}")
            return True
        else:
            print(f"[WARNING] API returned status {r.status_code}: {r.text}")
            print("[FALLBACK] Attempting direct DB seeding...")
            return seed_via_direct_db()
    except Exception as e:
        print(f"[WARNING] HTTP request failed ({e}). Falling back to direct DB seeding...")
        return seed_via_direct_db()

def main():
    parser = argparse.ArgumentParser(description="AgentShield Demo Seeder")
    parser.add_argument("--api-url", default=None, help="AgentShield base URL for HTTP seed endpoint")
    parser.add_argument("--direct-db", action="store_true", help="Force direct database seeding")
    args = parser.parse_args()

    if args.direct_db or not args.api_url:
        success = seed_via_direct_db()
    else:
        success = seed_via_http(args.api_url)

    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
