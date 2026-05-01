#!/bin/bash

# Start script for Render.com deployment
echo "🌟 Starting Venocyber Status View King 👑"

# Create necessary directories
mkdir -p auth_info

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the application
echo "🚀 Starting the bot..."
node index.js
