#!/bin/bash

set -e

echo "DSR Frontend Installation Script for Ubuntu"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Variables
INSTALL_DIR="/opt/dsr/frontend"
SERVICE_NAME="dsr-frontend"
NGINX_CONF="/etc/nginx/sites-available/dsr-frontend"
NGINX_ENABLED="/etc/nginx/sites-enabled/dsr-frontend"
BUILD_DIR="$(pwd)/../../frontend"

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

# Install dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y nginx nodejs npm

# Build frontend
echo "Building frontend application..."
cd "$BUILD_DIR"
npm install
npm run build

# Copy built files
echo "Copying built files to $INSTALL_DIR..."
cp -r dist/* "$INSTALL_DIR/"
chown -R www-data:www-data "$INSTALL_DIR"

# Create simple Node.js static server for systemd
cat > "$INSTALL_DIR/server.js" << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DSR Frontend server running on port ${PORT}`);
});
EOF

# Install express for static server
cd "$INSTALL_DIR"
npm init -y
npm install express

# Configure nginx
echo "Configuring nginx..."
cp nginx-frontend.conf "$NGINX_CONF"

# Update nginx config with actual server names
read -p "Enter backend server address (e.g., backend1.example.com:8080): " BACKEND_SERVER
read -p "Enter streaming server address (e.g., streaming1.example.com:8888): " STREAMING_SERVER
read -p "Enter domain name for this server (or press Enter for default): " DOMAIN_NAME

if [ -n "$BACKEND_SERVER" ]; then
  sed -i "s/backend1.example.com:8080/$BACKEND_SERVER/g" "$NGINX_CONF"
fi

if [ -n "$STREAMING_SERVER" ]; then
  sed -i "s/streaming1.example.com:8888/$STREAMING_SERVER/g" "$NGINX_CONF"
fi

if [ -n "$DOMAIN_NAME" ]; then
  sed -i "s/server_name localhost;/server_name $DOMAIN_NAME;/g" "$NGINX_CONF"
fi

# Enable nginx site
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Remove default nginx site if exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Install systemd service
echo "Installing systemd service..."
cp dsr-frontend.service /etc/systemd/system/

# Reload systemd and start services
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
systemctl restart nginx

echo ""
echo "Installation complete!"
echo "====================="
echo "Frontend installed to: $INSTALL_DIR"
echo "Systemd service: $SERVICE_NAME"
echo "Nginx config: $NGINX_CONF"
echo ""
echo "To check service status:"
echo "  systemctl status $SERVICE_NAME"
echo "  systemctl status nginx"
echo ""
echo "To view logs:"
echo "  journalctl -u $SERVICE_NAME -f"
echo "  tail -f /var/log/nginx/error.log"
echo ""
echo "To update backend/streaming servers:"
echo "  Edit $NGINX_CONF and restart nginx"