"""RAG (Retrieval-Augmented Generation) system for course materials."""
from typing import Any, Dict, List, Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from pathlib import Path
import json

from app.config import get_settings

settings = get_settings()


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
                
            # Split into chunks (simple splitting by sections)
            chunks = self._split_into_chunks(content)
            
            for chunk in chunks:
                self.documents.append(chunk)
                self.metadata.append({
                    "source": str(file_path.relative_to(materials_dir)),
                    "type": "course_material"
                })
        
        # Load Python notebooks/code examples
        for file_path in materials_dir.rglob("*.py"):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            self.documents.append(content)
            self.metadata.append({
                "source": str(file_path.relative_to(materials_dir)),
                "type": "code_example"
            })
        
        print(f"Loaded {len(self.documents)} document chunks")
        
    def generate_embeddings(self):
        """Generate embeddings for all documents."""
        print("Generating embeddings...")
        self.embeddings = self.embedding_model.encode(
            self.documents,
            show_progress_bar=True,
            convert_to_numpy=True
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
        filter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant documents for a query.
        
        Args:
            query: Search query
            top_k: Number of results to return
            filter_type: Optional filter for document type
            
        Returns:
            List of relevant documents with metadata and scores
        """
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query])[0]
        
        # Calculate similarity scores
        similarities = np.dot(self.embeddings, query_embedding)
        
        # Apply filter if specified
        if filter_type:
            filtered_indices = [
                i for i, meta in enumerate(self.metadata)
                if meta.get("type") == filter_type
            ]
            similarities = similarities[filtered_indices]
            valid_indices = filtered_indices
        else:
            valid_indices = list(range(len(self.documents)))
        
        # Get top k
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        results = []
        for idx in top_indices:
            original_idx = valid_indices[idx] if filter_type else idx
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
