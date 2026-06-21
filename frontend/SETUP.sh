#!/bin/bash

# VeritasChain Frontend - Complete Setup Guide

echo "🚀 VeritasChain Frontend Setup"
echo "=============================="
echo ""

# 1. Install dependencies
echo "📦 Installing dependencies..."
cd frontend
npm install

# 2. Create environment file
echo ""
echo "🔧 Creating environment file..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✓ .env.local created (adjust VITE_API_URL if needed)"
else
    echo "✓ .env.local already exists"
fi

# 3. Build
echo ""
echo "🏗️  Building frontend..."
npm run build

# 4. Display status
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Quick Commands:"
echo "   npm run dev      - Start development server (http://localhost:5173)"
echo "   npm run build    - Build for production"
echo "   npm run preview  - Preview production build"
echo ""
echo "🌐 Access the app:"
echo "   Development: http://localhost:5173"
echo "   Make sure backend is running on http://localhost:3000"
echo ""
