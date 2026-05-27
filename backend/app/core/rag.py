"""RAG (Retrieval-Augmented Generation) system for course materials."""
from typing import Any, Dict, List, Optional, Tuple
from sentence_transformers import SentenceTransformer
import numpy as np
from pathlib import Path
import json

from app.config import get_settings

settings = get_settings()


def parse_frontmatter(content: str) -> Tuple[Dict[str, str], str]:
    """Strip a `---key: value---` YAML-ish header off a markdown string.

    Returns (metadata, body). If the file has no header, returns ({}, content)
    unchanged. We deliberately avoid pulling in pyyaml — the header is just
    a few flat key/value lines, and a stricter parser is happy to reject
    anything more elaborate.
    """
    if not content.startswith("---\n"):
        return {}, content
    end = content.find("\n---\n", 4)
    if end == -1:
        return {}, content
    header, body = content[4:end], content[end + 5:]
    meta: Dict[str, str] = {}
    for line in header.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, body


class RAGSystem:
    """Retrieval-Augmented Generation system for Linear Algebra materials."""
    
    def __init__(self):
        """Initialize the RAG system."""
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.documents = []
        self.embeddings = None
        self.metadata = []
        
    def load_materials(self, materials_dir: Path):
        """
        Load course materials from directory.
        
        Args:
            materials_dir: Path to directory containing course materials
        """
        print(f"Loading materials from {materials_dir}...")
        
        # Load documents (markdown, text files)
        for file_path in materials_dir.rglob("*.md"):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Optional `--- chapter: 1 / topic: vectors ---` front-matter
            # gets merged into each chunk's metadata so retrieve() can
            # filter by it. Falls through cleanly when the file has no header.
            extra_meta, body = parse_frontmatter(content)
            chunks = self._split_into_chunks(body)

            for chunk in chunks:
                self.documents.append(chunk)
                self.metadata.append({
                    "source": str(file_path.relative_to(materials_dir)),
                    "type": "course_material",
                    **extra_meta,
                })
        
        # Load Python notebooks/code examples (chunked so long files don't
        # drown out shorter, more relevant matches)
        for file_path in materials_dir.rglob("*.py"):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            for chunk in self._split_into_chunks(content):
                self.documents.append(chunk)
                self.metadata.append({
                    "source": str(file_path.relative_to(materials_dir)),
                    "type": "code_example"
                })
        
        print(f"Loaded {len(self.documents)} document chunks")
        
    def generate_embeddings(self):
        """Generate embeddings for all documents."""
        print("Generating embeddings...")
        # normalize_embeddings=True makes dot product equal cosine similarity,
        # which is what retrieve() actually wants.
        self.embeddings = self.embedding_model.encode(
            self.documents,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        print(f"Generated embeddings with shape {self.embeddings.shape}")
        
    def save_embeddings(self, output_dir: Path):
        """Save embeddings and metadata to disk."""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        np.save(output_dir / "embeddings.npy", self.embeddings)
        
        with open(output_dir / "documents.json", 'w', encoding='utf-8') as f:
            json.dump(self.documents, f, ensure_ascii=False, indent=2)
            
        with open(output_dir / "metadata.json", 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)
            
        print(f"Saved embeddings to {output_dir}")
        
    def load_embeddings(self, embeddings_dir: Path):
        """Load pre-generated embeddings from disk."""
        print(f"Loading embeddings from {embeddings_dir}...")
        
        self.embeddings = np.load(embeddings_dir / "embeddings.npy")
        
        with open(embeddings_dir / "documents.json", 'r', encoding='utf-8') as f:
            self.documents = json.load(f)
            
        with open(embeddings_dir / "metadata.json", 'r', encoding='utf-8') as f:
            self.metadata = json.load(f)
            
        print(f"Loaded {len(self.documents)} documents with embeddings")
        
    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        filter_type: Optional[str] = None,
        chapter: Optional[str] = None,
        topic: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant documents for a query.

        Args:
            query: Search query
            top_k: Number of results to return
            filter_type: Optional filter for document type
            chapter: Optional filter on the chapter metadata field
            topic: Optional filter on the topic metadata field

        Returns:
            List of relevant documents with metadata and scores
        """
        # Generate query embedding (normalized to match stored embeddings, so
        # the dot product below is cosine similarity)
        query_embedding = self.embedding_model.encode(
            [query], normalize_embeddings=True
        )[0]

        # Calculate similarity scores
        similarities = np.dot(self.embeddings, query_embedding)

        # Build the filter as an AND across whichever fields the caller set.
        # Compared as lowercase strings so retrieval is forgiving of casing.
        def _matches(meta: Dict[str, Any]) -> bool:
            if filter_type is not None and meta.get("type") != filter_type:
                return False
            if chapter is not None and str(meta.get("chapter", "")).lower() != chapter.lower():
                return False
            if topic is not None and str(meta.get("topic", "")).lower() != topic.lower():
                return False
            return True

        any_filter = any(f is not None for f in (filter_type, chapter, topic))
        if any_filter:
            filtered_indices = [
                i for i, meta in enumerate(self.metadata) if _matches(meta)
            ]
            similarities = similarities[filtered_indices]
            valid_indices = filtered_indices
        else:
            valid_indices = list(range(len(self.documents)))

        # Get top k
        top_indices = np.argsort(similarities)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            original_idx = valid_indices[idx] if any_filter else idx
            results.append({
                "content": self.documents[original_idx],
                "metadata": self.metadata[original_idx],
                "score": float(similarities[idx])
            })
        
        return results
    
    def _split_into_chunks(
        self,
        text: str,
        chunk_size: int = 500,
        overlap: int = 50
    ) -> List[str]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Text to split
            chunk_size: Approximate size of each chunk
            overlap: Number of characters to overlap between chunks
            
        Returns:
            List of text chunks
        """
        # Simple chunking by paragraphs and size
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) < chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks


# Singleton instance
rag_system = RAGSystem()
