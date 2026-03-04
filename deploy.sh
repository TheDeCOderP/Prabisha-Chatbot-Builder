#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Move to project directory
cd /var/www/chatbots

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git fetch origin
git reset --hard origin/main

# Load nvm if available to ensure correct Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check Node.js version
REQUIRED_NODE_VERSION="20.9.0"
CURRENT_NODE_VERSION=$(node -v | sed 's/v//')

echo "📌 Current Node version: v$CURRENT_NODE_VERSION"
echo "📌 Required Node version: v$REQUIRED_NODE_VERSION"

# Compare versions
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$CURRENT_NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    echo "⚠️  Node.js version is too old. Please upgrade to v20.9.0 or higher."
    echo "💡 Run: nvm install 20 && nvm use 20 && nvm alias default 20"
    exit 1
fi

# Ensure pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "📌 pnpm version: $(pnpm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the application
echo "🏗️ Building application..."
pnpm build

# Cleanup any leftover build workers
echo "🧹 Cleaning up build workers..."
pkill -9 -f "jest-worker/processChild.js" || true

# Flush PM2 logs
echo "🧾 Flushing PM2 logs..."
pm2 flush

# Restart PM2 process
echo "🔁 Restarting PM2 process..."
pm2 restart chatbots-3011 --update-env

echo "✅ Deployment completed successfully!"
