#!/bin/bash

# Setup script for Linear Algebra AI Tutor
# This script helps set up the development environment

set -e  # Exit on error

echo "🎓 Linear Algebra AI Tutor - Setup Script"
echo "==========================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Python
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 not found. Please install Python 3.11+"
        exit 1
    fi
    echo "✓ Python $(python3 --version)"
    
    # Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js 20+"
        exit 1
    fi
    echo "✓ Node.js $(node --version)"
    
    # Corepack (ships with Node 16.10+) — needed for the pinned Yarn version
    if ! command -v corepack &> /dev/null; then
        echo "❌ corepack not found. Please install Node.js 20+ (corepack ships with it)"
        exit 1
    fi
    echo "✓ Corepack $(corepack --version)"

    echo ""
}

# Setup backend
setup_backend() {
    echo "Setting up backend..."
    cd backend
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    echo "Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    
    echo "✓ Backend setup complete"
    cd ..
    echo ""
}

# Setup frontend
setup_frontend() {
    echo "Setting up frontend..."
    cd frontend

    # Activate the pinned Yarn version from package.json's packageManager field
    corepack enable

    # Install dependencies
    echo "Installing Node dependencies..."
    yarn install --immutable

    echo "✓ Frontend setup complete"
    cd ..
    echo ""
}

# Setup environment
setup_env() {
    echo "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "✓ Created .env file from template"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY"
        echo "   Get your API key at: https://console.anthropic.com"
        echo ""
    else
        echo "✓ .env file already exists"
        echo ""
    fi
}

# Setup data directories
setup_data() {
    echo "Setting up data directories..."
    
    mkdir -p data/materials
    mkdir -p data/embeddings
    
    echo "✓ Data directories created"
    echo ""
    
    if [ ! "$(ls -A data/materials)" ]; then
        echo "ℹ️  Add your course materials to data/materials/"
        echo "   Supported formats: .md, .py, .txt"
        echo "   Example materials have been created in data/materials/"
        echo ""
    fi
}

# Main setup
main() {
    check_prerequisites
    setup_backend
    setup_frontend
    setup_env
    setup_data
    
    echo "========================================="
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Edit .env and add your ANTHROPIC_API_KEY"
    echo "   Get it at: https://console.anthropic.com"
    echo ""
    echo "2. Add course materials to data/materials/"
    echo "   (Example materials included)"
    echo ""
    echo "3. Generate embeddings:"
    echo "   python scripts/generate_embeddings.py"
    echo ""
    echo "4. Start the backend (Terminal 1):"
    echo "   cd backend"
    echo "   source venv/bin/activate"
    echo "   python -m app.main"
    echo ""
    echo "5. Start the frontend (Terminal 2):"
    echo "   cd frontend"
    echo "   yarn dev"
    echo ""
    echo "6. Open http://localhost:5173 in your browser"
    echo ""
    echo "For Docker deployment, see README.md"
    echo "========================================="
}

# Run main
main
