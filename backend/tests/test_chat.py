"""Tests for /api/v1/chat endpoints.

The tutor_service.answer_question is patched so tests don't hit Claude.
"""
from unittest.mock import AsyncMock

import pytest


@pytest.fixture
def mock_tutor(monkeypatch):
    """Patch the tutor service to return a deterministic answer."""
    mock = AsyncMock(
        return_value={
            "answer": "The dot product equals 32.",
            "sources": [{"source": "ch1.md", "type": "course_material"}],
            "context_used": True,
        }
    )
    monkeypatch.setattr("app.api.chat.tutor_service.answer_question", mock)
    return mock


async def test_create_conversation_requires_auth(client):
    resp = await client.post("/api/v1/chat/conversations", json={"title": "x"})
    assert resp.status_code == 401


async def test_create_conversation(client, auth_headers):
    resp = await client.post(
        "/api/v1/chat/conversations",
        json={"title": "Vectors 101"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Vectors 101"
    assert body["message_count"] == 0
    assert "id" in body


async def test_list_conversations(client, auth_headers):
    await client.post(
        "/api/v1/chat/conversations",
        json={"title": "A"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/chat/conversations",
        json={"title": "B"},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/chat/conversations", headers=auth_headers)
    assert resp.status_code == 200
    titles = {c["title"] for c in resp.json()}
    assert titles == {"A", "B"}


async def test_send_message_persists_and_calls_tutor(
    client, auth_headers, mock_tutor
):
    conv = await client.post(
        "/api/v1/chat/conversations",
        json={"title": "Q&A"},
        headers=auth_headers,
    )
    cid = conv.json()["id"]

    resp = await client.post(
        f"/api/v1/chat/conversations/{cid}/messages",
        json={"content": "What is a dot product?"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["answer"] == "The dot product equals 32."
    assert body["conversation_id"] == cid
    assert body["sources"][0]["source"] == "ch1.md"

    mock_tutor.assert_awaited_once()
    call_kwargs = mock_tutor.await_args.kwargs
    assert call_kwargs["question"] == "What is a dot product?"
    # First message: history should be empty (we exclude the just-saved message)
    assert call_kwargs["conversation_history"] == []

    msgs = await client.get(
        f"/api/v1/chat/conversations/{cid}/messages", headers=auth_headers
    )
    assert msgs.status_code == 200
    msg_list = msgs.json()
    assert [m["role"] for m in msg_list] == ["user", "assistant"]
    assert msg_list[0]["content"] == "What is a dot product?"
    assert msg_list[1]["content"] == "The dot product equals 32."
    # API response key is "metadata" even though the column is extra_metadata
    assert msg_list[1]["metadata"] == {
        "sources": [{"source": "ch1.md", "type": "course_material"}]
    }


async def test_send_message_passes_history_on_followup(
    client, auth_headers, mock_tutor
):
    conv = await client.post(
        "/api/v1/chat/conversations",
        json={"title": "thread"},
        headers=auth_headers,
    )
    cid = conv.json()["id"]
    await client.post(
        f"/api/v1/chat/conversations/{cid}/messages",
        json={"content": "first"},
        headers=auth_headers,
    )
    mock_tutor.reset_mock()
    await client.post(
        f"/api/v1/chat/conversations/{cid}/messages",
        json={"content": "second"},
        headers=auth_headers,
    )
    history = mock_tutor.await_args.kwargs["conversation_history"]
    roles = [m["role"] for m in history]
    assert roles == ["user", "assistant"]
    assert history[0]["content"] == "first"


async def test_cannot_message_other_users_conversation(
    client, auth_headers, second_user_headers, mock_tutor
):
    conv = await client.post(
        "/api/v1/chat/conversations",
        json={"title": "private"},
        headers=auth_headers,
    )
    cid = conv.json()["id"]
    resp = await client.post(
        f"/api/v1/chat/conversations/{cid}/messages",
        json={"content": "hi"},
        headers=second_user_headers,
    )
    assert resp.status_code == 404
    mock_tutor.assert_not_awaited()


async def test_cannot_read_other_users_messages(
    client, auth_headers, second_user_headers
):
    conv = await client.post(
        "/api/v1/chat/conversations",
        json={"title": "private"},
        headers=auth_headers,
    )
    cid = conv.json()["id"]
    resp = await client.get(
        f"/api/v1/chat/conversations/{cid}/messages",
        headers=second_user_headers,
    )
    assert resp.status_code == 404
