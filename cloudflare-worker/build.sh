#!/bin/bash

# Exit on error
set -e

echo "=== Building application for Cloudflare ==="

# Go to frontend directory and install dependencies
echo "Installing frontend dependencies..."
cd ../../frontend
npm install

# Build frontend into worker's dist folder
echo "Building frontend..."
npm run build -- --outDir ../cloudflare-worker/steam-profile-metrics/dist --emptyOutDir

# Go back to worker directory
cd ../cloudflare-worker/steam-profile-metrics

echo "=== Build complete! ==="
