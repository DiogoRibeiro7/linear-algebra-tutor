"""Tests for the RAG system (pure logic, with a fake embedding model)."""
from unittest.mock import MagicMock

import numpy as np

from app.core.rag import RAGSystem


def _make_rag_with_fake_model() -> RAGSystem:
    """Build a RAGSystem and stub its embedding model with a deterministic fake."""
    rag = RAGSystem()
    rag.embedding_model = MagicMock()
    return rag


def test_split_into_chunks_short_text_returns_single_chunk():
    rag = _make_rag_with_fake_model()
    chunks = rag._split_into_chunks("short text", chunk_size=500)
    assert len(chunks) == 1
    assert chunks[0] == "short text"


def test_split_into_chunks_paragraphs():
    rag = _make_rag_with_fake_model()
    text = ("A" * 300) + "\n\n" + ("B" * 300) + "\n\n" + ("C" * 300)
    chunks = rag._split_into_chunks(text, chunk_size=400)
    # Each paragraph (~300 chars) plus another would exceed 400 → split per paragraph
    assert len(chunks) >= 2
    # No chunk should be empty
    assert all(c.strip() for c in chunks)


def test_retrieve_returns_top_k_sorted_by_similarity():
    rag = _make_rag_with_fake_model()
    rag.documents = ["alpha", "beta", "gamma"]
    rag.metadata = [
        {"source": "a.md", "type": "course_material"},
        {"source": "b.md", "type": "course_material"},
        {"source": "c.md", "type": "code_example"},
    ]
    # Embeddings: doc 1 (beta) is most similar to the query
    rag.embeddings = np.array(
        [
            [1.0, 0.0],
            [0.9, 0.1],  # highest dot product with query
            [0.0, 1.0],
        ],
        dtype="float32",
    )
    rag.embedding_model.encode = MagicMock(
        return_value=np.array([[1.0, 0.0]], dtype="float32")
    )

    results = rag.retrieve("anything", top_k=2)
    assert len(results) == 2
    # Order: highest similarity first
    assert results[0]["content"] == "alpha"
    assert results[1]["content"] == "beta"
    assert results[0]["score"] >= results[1]["score"]


def test_retrieve_attaches_metadata():
    rag = _make_rag_with_fake_model()
    rag.documents = ["only doc"]
    rag.metadata = [{"source": "x.md", "type": "course_material"}]
    rag.embeddings = np.array([[1.0, 0.0]], dtype="float32")
    rag.embedding_model.encode = MagicMock(
        return_value=np.array([[1.0, 0.0]], dtype="float32")
    )

    results = rag.retrieve("q", top_k=1)
    assert results[0]["metadata"]["source"] == "x.md"
    assert isinstance(results[0]["score"], float)
