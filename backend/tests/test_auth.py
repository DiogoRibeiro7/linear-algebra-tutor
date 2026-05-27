"""Tests for /api/v1/auth endpoints."""

REGISTER_PAYLOAD = {
    "username": "newbie",
    "email": "newbie@example.com",
    "password": "hunter2hunter2",
    "full_name": "New B.",
}


async def test_register_success(client):
    resp = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["username"] == "newbie"
    assert body["email"] == "newbie@example.com"
    assert body["is_active"] is True
    assert "password" not in body
    assert "hashed_password" not in body


async def test_register_duplicate_username(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    dup = {**REGISTER_PAYLOAD, "email": "different@example.com"}
    resp = await client.post("/api/v1/auth/register", json=dup)
    assert resp.status_code == 400
    assert "username" in resp.json()["message"].lower()


async def test_register_duplicate_email(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    dup = {**REGISTER_PAYLOAD, "username": "different"}
    resp = await client.post("/api/v1/auth/register", json=dup)
    assert resp.status_code == 400
    assert "email" in resp.json()["message"].lower()


async def test_register_rejects_invalid_email(client):
    bad = {**REGISTER_PAYLOAD, "email": "not-an-email"}
    resp = await client.post("/api/v1/auth/register", json=bad)
    assert resp.status_code == 422


async def test_login_success(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "newbie", "password": "hunter2hunter2"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "newbie", "password": "nope"},
    )
    assert resp.status_code == 401


async def test_login_unknown_user(client):
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "ghost", "password": "whatever"},
    )
    assert resp.status_code == 401


async def test_me_requires_token(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_returns_user(client, auth_headers):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["username"] == "tester"
    assert body["email"] == "tester@example.com"


async def test_me_rejects_bogus_token(client):
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401
