#!/bin/sh

echo "Generating env-config.js..."
echo "window._env_ = {" > /usr/share/nginx/html/env-config.js
echo "  VITE_API_URL: \"$VITE_API_URL\"" >> /usr/share/nginx/html/env-config.js
echo "};" >> /usr/share/nginx/html/env-config.js
echo "Done."
