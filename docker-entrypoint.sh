#!/bin/bash
set -e

echo "🚀 Starting TTSQL Application..."

# Start Ollama service in background
echo "🤖 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
sleep 5

# Pull and create the model
echo "📦 Setting up ttsql-model..."
cd /app

# Pull base model if not exists
if ! ollama list | grep -q "llama3.2:1b"; then
    echo "📥 Pulling llama3.2:1b model..."
    ollama pull llama3.2:1b
fi

# Create custom model
echo "🔧 Creating ttsql-model..."
ollama create ttsql-model -f Modelfile

# Initialize database if needed
if [ ! -f "/app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite" ]; then
    echo "📊 Initializing database..."
    sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite < schema.sql
    sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite < seed.sql
fi

# Start Node.js server
echo "🌐 Starting Node.js server on port 8787..."
node server.js

# If Node.js exits, cleanup Ollama
kill $OLLAMA_PID
