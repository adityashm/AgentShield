import pytest
from fastapi.testclient import TestClient
from app.core.security import hash_password, verify_password, validate_password_strength
from app.db.models import User, Organization

def test_argon2_hashing_and_verification():
    pw = "SuperSecurePassword2026!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert hashed.startswith("$argon2id$")
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False

def test_password_strength_policy():
    assert validate_password_strength("short") is False
    assert validate_password_strength("12345678901") is False  # 11 chars
    assert validate_password_strength("123456789012") is True  # 12 chars
    assert validate_password_strength("SuperSecretPassword2026!") is True

def test_login_success_and_cookie(client: TestClient, db):
    # Test seeded default admin login
    login_payload = {
        "email": "admin@agentshield.local",
        "password": "AdminPassword2026!",
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@agentshield.local"
    assert data["user"]["role"] == "admin"
    assert "refresh_token" in res.cookies

def test_login_throttling_after_5_failures(client: TestClient):
    bad_payload = {
        "email": "throttled_user@test.local",
        "password": "WrongPassword123!",
    }
    # First 4 attempts: 401 Unauthorized
    for _ in range(4):
        res = client.post("/api/v1/auth/login", json=bad_payload)
        assert res.status_code == 401

    # 5th attempt: 401 Unauthorized
    res5 = client.post("/api/v1/auth/login", json=bad_payload)
    assert res5.status_code == 401

    # 6th attempt: 429 Too Many Requests with Retry-After header
    res6 = client.post("/api/v1/auth/login", json=bad_payload)
    assert res6.status_code == 429
    assert "Retry-After" in res6.headers
    assert res6.headers["Content-Type"] == "application/problem+json"
    problem = res6.json()
    assert problem["title"] == "Too Many Requests"
    assert "request_id" in problem

def test_refresh_token_rotation(client: TestClient):
    # 1. Login to get refresh token
    login_payload = {
        "email": "admin@agentshield.local",
        "password": "AdminPassword2026!",
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    first_refresh = login_res.cookies.get("refresh_token")
    assert first_refresh is not None

    # 2. Call refresh
    client.cookies.set("refresh_token", first_refresh)
    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    second_refresh = refresh_res.cookies.get("refresh_token")
    assert second_refresh is not None
    assert second_refresh != first_refresh  # Token rotated

    # 3. Old refresh token should now be rejected
    client.cookies.set("refresh_token", first_refresh)
    revoked_res = client.post("/api/v1/auth/refresh")
    assert revoked_res.status_code == 401

def test_role_enforcement_on_admin_routes(client: TestClient, db):
    # Create a viewer user
    org = db.query(Organization).filter(Organization.id == "org_default").first()
    viewer_user = User(
        id="usr_viewer_test",
        org_id=org.id,
        email="viewer@agentshield.local",
        password_hash=hash_password("ViewerPassword2026!"),
        role="viewer",
        is_active=True,
    )
    db.add(viewer_user)
    db.commit()

    # Login as viewer
    v_res = client.post("/api/v1/auth/login", json={
        "email": "viewer@agentshield.local",
        "password": "ViewerPassword2026!",
    })
    assert v_res.status_code == 200
    viewer_token = v_res.json()["access_token"]

    # Viewer tries to access admin-only endpoint: GET /api/v1/users
    admin_res = client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert admin_res.status_code == 403
    assert admin_res.headers["Content-Type"] == "application/problem+json"
    problem = admin_res.json()
    assert problem["title"] == "Forbidden"
    assert "request_id" in problem
