#!/bin/bash

echo "🗺️  Setting up RieMap - Global Refined OpenStreetMap Data Service"
echo ""

# Check for required tools
command -v cargo >/dev/null 2>&1 || { echo "❌ Rust/Cargo is required but not installed. Please install from https://rustup.rs/" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install from https://nodejs.org/" >&2; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Setup backend
echo "🦀 Setting up Rust backend..."
cd backend

echo "   📦 Installing Rust dependencies..."
cargo build --release

echo "   🔧 Initializing data structures..."
cargo run --bin riemap-processor init

echo "   📊 Downloading sample data for Liechtenstein..."
cargo run --bin riemap-processor download liechtenstein

cd ..
echo "✅ Backend setup complete"
echo ""

# Setup frontend
echo "🌐 Setting up Next.js frontend..."
cd frontend

echo "   📦 Installing Node.js dependencies..."
npm install

echo "   🏗️  Building frontend..."
npm run build

cd ..
echo "✅ Frontend setup complete"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Start the backend server:"
echo "   cd backend && cargo run --bin riemap-server"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Open your browser to http://localhost:3000"
echo ""
echo "API will be running on http://localhost:3001"
echo "Sample data for Liechtenstein will be available!" 