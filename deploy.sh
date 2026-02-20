
set -e

echo "🚀 Starting deployment..."

# Move to project directory (safety)
cd /var/www/chatbots

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull

# Install dependencies (lockfile respected)
echo "📦 Installing dependencies..."
pnpm install 

# Build the application in a clean context
echo "🏗️ Building application..."
pnpm build

# Cleanup any leftover build workers (important)
echo "🧹 Cleaning up build workers..."
pkill -9 -f "jest-worker/processChild.js" || true

# Flush PM2 logs
echo "🧾 Flushing PM2 logs..."
pm2 flush

# Restart PM2 process safely
echo "🔁 Restarting PM2 process..."
pm2 restart chatbots-3011 --update-env

echo "✅ Deployment completed successfully!"
