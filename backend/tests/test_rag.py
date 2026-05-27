"""Tests for the RAG system (pure logic, with a fake embedding model)."""
from unittest.mock import MagicMock

import numpy as np

from app.core.rag import RAGSystem, parse_frontmatter


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


# --- front-matter parsing ----------------------------------------------


def test_parse_frontmatter_empty_when_absent():
    meta, body = parse_frontmatter("Just some text\n")
    assert meta == {}
    assert body == "Just some text\n"


def test_parse_frontmatter_extracts_kv_pairs():
    src = "---\nchapter: 1\ntopic: vectors\n---\n# Vectors\n\nBody"
    meta, body = parse_frontmatter(src)
    assert meta == {"chapter": "1", "topic": "vectors"}
    assert body == "# Vectors\n\nBody"


def test_parse_frontmatter_unclosed_header_is_ignored():
    """A `---` opener with no closer must not eat the document body."""
    src = "---\nchapter: 1\nbody continues but no closer"
    meta, body = parse_frontmatter(src)
    assert meta == {}
    assert body == src


def test_parse_frontmatter_tolerates_lines_without_colon():
    """Lines that aren't `key: value` are skipped, not crashed on."""
    src = "---\nchapter: 1\ngarbage line\ntopic: vectors\n---\nbody"
    meta, _ = parse_frontmatter(src)
    assert meta == {"chapter": "1", "topic": "vectors"}


# --- retrieve filtering by chapter/topic -------------------------------


def _three_docs_with_topics():
    rag = _make_rag_with_fake_model()
    rag.documents = ["vec a", "vec b", "mat a"]
    rag.metadata = [
        {"source": "a.md", "type": "course_material", "topic": "vectors"},
        {"source": "b.md", "type": "course_material", "topic": "vectors"},
        {"source": "c.md", "type": "course_material", "topic": "matrices"},
    ]
    # All three vectors point in the same direction; identity ranking.
    rag.embeddings = np.array(
        [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]], dtype="float32"
    )
    rag.embedding_model.encode = MagicMock(
        return_value=np.array([[1.0, 0.0]], dtype="float32")
    )
    return rag


def test_retrieve_filters_to_matching_topic():
    rag = _three_docs_with_topics()
    results = rag.retrieve("q", top_k=10, topic="vectors")
    sources = {r["metadata"]["source"] for r in results}
    assert sources == {"a.md", "b.md"}


def test_retrieve_topic_filter_is_case_insensitive():
    rag = _three_docs_with_topics()
    results = rag.retrieve("q", top_k=10, topic="VECTORS")
    sources = {r["metadata"]["source"] for r in results}
    assert sources == {"a.md", "b.md"}


def test_retrieve_no_topic_filter_returns_all():
    rag = _three_docs_with_topics()
    results = rag.retrieve("q", top_k=10)
    sources = {r["metadata"]["source"] for r in results}
    assert sources == {"a.md", "b.md", "c.md"}


def test_retrieve_chapter_and_topic_are_anded():
    rag = _make_rag_with_fake_model()
    rag.documents = ["x", "y", "z"]
    rag.metadata = [
        {"source": "a.md", "type": "course_material", "chapter": "1", "topic": "vectors"},
        {"source": "b.md", "type": "course_material", "chapter": "1", "topic": "matrices"},
        {"source": "c.md", "type": "course_material", "chapter": "2", "topic": "vectors"},
    ]
    rag.embeddings = np.array(
        [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]], dtype="float32"
    )
    rag.embedding_model.encode = MagicMock(
        return_value=np.array([[1.0, 0.0]], dtype="float32")
    )
    results = rag.retrieve("q", top_k=10, chapter="1", topic="vectors")
    sources = {r["metadata"]["source"] for r in results}
    assert sources == {"a.md"}
