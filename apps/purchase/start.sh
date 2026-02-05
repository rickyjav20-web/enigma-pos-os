#!/bin/bash
# Enigma Purchase App - Standalone Launcher

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🚀 Starting Enigma Purchase App (Standalone Mode)..."
export FLASK_APP=backend/app.py
export FLASK_ENV=development

# Check dependencies
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚙️  Installing dependencies..."
    pip install -r backend/requirements.txt
fi

# Run
echo "🟢 Server starting on http://localhost:5005"
python3 backend/app.py
