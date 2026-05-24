#!/usr/bin/env python3
"""
Script to generate embeddings from Linear Algebra course materials.

This script:
1. Loads materials from the data/materials directory
2. Splits them into chunks
3. Generates embeddings using sentence transformers
4. Saves embeddings to data/embeddings directory

Usage:
    python scripts/generate_embeddings.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.rag import rag_system


def main():
    """Generate and save embeddings."""
    # Directories
    materials_dir = Path("data/materials")
    embeddings_dir = Path("data/embeddings")
    
    # Check if materials exist
    if not materials_dir.exists():
        print(f"Error: Materials directory not found at {materials_dir}")
        print("\nPlease create the directory and add your Linear Algebra materials:")
        print(f"  mkdir -p {materials_dir}")
        print(f"  # Add .md, .py, .txt files to {materials_dir}")
        return
    
    # Check if there are any files
    files = list(materials_dir.rglob("*.md")) + list(materials_dir.rglob("*.py")) + list(materials_dir.rglob("*.txt"))
    if not files:
        print(f"Error: No materials found in {materials_dir}")
        print("\nSupported formats: .md, .py, .txt")
        print("\nExample structure:")
        print(f"  {materials_dir}/")
        print("    chapter1_vectors.md")
        print("    chapter2_matrices.md")
        print("    examples/")
        print("      vector_operations.py")
        return
    
    print(f"Found {len(files)} files to process")
    
    # Load materials
    print("\n1. Loading materials...")
    rag_system.load_materials(materials_dir)
    
    # Generate embeddings
    print("\n2. Generating embeddings...")
    rag_system.generate_embeddings()
    
    # Save embeddings
    print("\n3. Saving embeddings...")
    rag_system.save_embeddings(embeddings_dir)
    
    print("\n✓ Done! Embeddings saved to", embeddings_dir)
    print("\nYou can now start the application:")
    print("  cd backend")
    print("  python -m app.main")


if __name__ == "__main__":
    main()
