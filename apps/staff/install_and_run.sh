#!/bin/bash

# Enigma Staff - Auto Installer
# Usage: ./install_and_run.sh

echo "🔮 Enigma Staff Installer Initiated..."

# Check requirements
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not found."
    echo "💡 Recommendation: Please install Node.js from https://nodejs.org/"
    echo "   Or if you have NVM, ensure it is loaded in your shell."
    exit 1
fi

echo "📂 Setting up Backend..."
cd server
if [ ! -f .env ]; then
    echo "⚠️  Creating default .env (Please update DATABASE_URL manually if needed)"
    echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/enigmastaff?schema=public"' > .env
    echo 'PORT=3000' >> .env
fi

echo "📦 Installing Server Dependencies..."
npm install

echo "🗄️  Setting up Database (Prisma)..."
# Try to reach DB. If fails, warn user.
if npx prisma db push; then
    echo "✅ Database pushed."
    echo "🌱 Seeding data..."
    npm run seed
else
    echo "❌ Database connection failed."
    echo "Please ensure PostgreSQL is running and update server/.env with correct credentials."
    echo "Then run: cd server && npx prisma db push && npm run seed"
fi

echo "📂 Setting up Frontend..."
cd ../client
echo "📦 Installing Client Dependencies..."
npm install

echo "✨ Installation Complete!"
echo "---------------------------------------------------"
echo "To start the Backend:"
echo "  cd server && npm run dev"
echo ""
echo "To start the Frontend (Kiosk/Admin):"
echo "  cd client && npm run dev"
echo "---------------------------------------------------"
