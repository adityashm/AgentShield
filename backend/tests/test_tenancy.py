import pytest
from fastapi.testclient import TestClient
from app.db.models import Organization, User, Agent, APIKey
from app.core.security import hash_password
from app.services.auth import generate_api_key

def test_cross_tenant_isolation_on_users(client: TestClient, db):
    # 1. Create Tenant A
    org_a = Organization(
        id="org_alpha",
        name="Alpha Industries",
        slug="alpha-ind",
        is_synthetic=False,
    )
    user_a = User(
        id="usr_alpha_admin",
        org_id="org_alpha",
        email="admin@alpha.com",
        password_hash=hash_password("AlphaAdminPassword2026!"),
        role="admin",
        is_active=True,
    )
    db.add(org_a)
    db.add(user_a)

    # 2. Create Tenant B
    org_b = Organization(
        id="org_beta",
        name="Beta Logistics",
        slug="beta-logistics",
        is_synthetic=False,
    )
    user_b = User(
        id="usr_beta_member",
        org_id="org_beta",
        email="member@beta.com",
        password_hash=hash_password("BetaMemberPassword2026!"),
        role="analyst",
        is_active=True,
    )
    db.add(org_b)
    db.add(user_b)
    db.commit()

    # 3. Log in as Alpha Admin
    login_a = client.post("/api/v1/auth/login", json={
        "email": "admin@alpha.com",
        "password": "AlphaAdminPassword2026!",
    })
    assert login_a.status_code == 200
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 4. Alpha Admin lists users: should only see user_a, NOT user_b
    list_res = client.get("/api/v1/users", headers=headers_a)
    assert list_res.status_code == 200
    user_ids = [u["id"] for u in list_res.json()]
    assert "usr_alpha_admin" in user_ids
    assert "usr_beta_member" not in user_ids

    # 5. Alpha Admin attempts to modify Beta's user -> 404 Not Found
    patch_res = client.patch(
        "/api/v1/users/usr_beta_member",
        json={"role": "admin"},
        headers=headers_a,
    )
    assert patch_res.status_code == 404
    assert patch_res.headers["Content-Type"] == "application/problem+json"

    # 6. Alpha Admin attempts to delete Beta's user -> 404 Not Found
    del_res = client.delete("/api/v1/users/usr_beta_member", headers=headers_a)
    assert del_res.status_code == 404
    assert del_res.headers["Content-Type"] == "application/problem+json"

def test_production_environment_startup_check():
    from app.core.config import Settings, DEV_DEFAULT_JWT_SECRET
    import pydantic

    # When ENVIRONMENT=production, default JWT_SECRET should raise validation error
    with pytest.raises(pydantic.ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET=DEV_DEFAULT_JWT_SECRET,
        )
    assert "Production startup refused" in str(exc_info.value)
