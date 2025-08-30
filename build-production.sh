#!/bin/bash

# Production build script for Mok Sports Draft
# This demonstrates the correct build process for deployment

echo "🚀 Building Mok Sports Draft for production..."

# Set production environment
export NODE_ENV=production

# Step 1: Build client
echo "📦 Building client..."
npm run build:client || { echo "❌ Client build failed"; exit 1; }

# Step 2: Build server for production
echo "🔧 Building server..."
mkdir -p server/dist
npx esbuild server/prod.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=server/dist \
  --target=node20 \
  --sourcemap || { echo "❌ Server build failed"; exit 1; }

echo "✅ Production build complete!"
echo ""
echo "📋 Build artifacts:"
echo "   - Client: ./client/dist/"
echo "   - Server: ./server/dist/prod.js"
echo ""
echo "🚀 To run in production:"
echo "   NODE_ENV=production node server/dist/prod.js"
echo ""
echo "🏥 Health check available at: /healthz"