#!/bin/bash

set -e

echo "DSR Backend Installation Script for Ubuntu"
echo "========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Variables
BACKEND_INSTALL_DIR="/opt/dsr/backend"
MEDIAMTX_INSTALL_DIR="/opt/dsr/mediamtx"
BACKEND_SERVICE="dsr-backend"
MEDIAMTX_SERVICE="dsr-mediamtx"
BUILD_DIR="$(pwd)/../.."
MEDIAMTX_VERSION="v1.6.0"
GO_VERSION="1.24"

# Check if PostgreSQL is accessible
read -p "Enter PostgreSQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}
read -p "Enter PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Enter PostgreSQL database name (default: dsr): " DB_NAME
DB_NAME=${DB_NAME:-dsr}
read -p "Enter PostgreSQL username (default: dsr): " DB_USER
DB_USER=${DB_USER:-dsr}
read -s -p "Enter PostgreSQL password: " DB_PASSWORD
echo

# Create system users
echo "Creating system users..."
useradd -r -s /bin/false dsr || true
useradd -r -s /bin/false mediamtx || true

# Create installation directories
echo "Creating installation directories..."
mkdir -p "$BACKEND_INSTALL_DIR"/{logs,config}
mkdir -p "$MEDIAMTX_INSTALL_DIR"/{recordings,config}

# Install Go if not present
if ! command -v go &> /dev/null || [[ $(go version | awk '{print $3}' | sed 's/go//') < "$GO_VERSION" ]]; then
    echo "Installing Go $GO_VERSION..."
    wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
    tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
    rm "go${GO_VERSION}.linux-amd64.tar.gz"
    export PATH=/usr/local/go/bin:$PATH
    echo 'export PATH=/usr/local/go/bin:$PATH' >> /etc/profile
fi

# Build backend
echo "Building backend application..."
cd "$BUILD_DIR"
export GOOS=linux
export GOARCH=amd64
go mod download
go build -o dsr-backend ./cmd/api

# Copy backend files
echo "Installing backend to $BACKEND_INSTALL_DIR..."
cp dsr-backend "$BACKEND_INSTALL_DIR/"
cp -r api "$BACKEND_INSTALL_DIR/" || true
chmod +x "$BACKEND_INSTALL_DIR/dsr-backend"
chown -R dsr:dsr "$BACKEND_INSTALL_DIR"

# Download and install MediaMTX
echo "Downloading MediaMTX $MEDIAMTX_VERSION..."
cd /tmp
wget -q "https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"
tar -xzf "mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"
cp mediamtx "$MEDIAMTX_INSTALL_DIR/"
chmod +x "$MEDIAMTX_INSTALL_DIR/mediamtx"
rm -f "mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz" mediamtx LICENSE

# Copy MediaMTX config
cd -
cp mediamtx.yml "$MEDIAMTX_INSTALL_DIR/"
chown -R mediamtx:mediamtx "$MEDIAMTX_INSTALL_DIR"

# Install systemd services
echo "Installing systemd services..."
cp dsr-backend.service /etc/systemd/system/
cp dsr-mediamtx.service /etc/systemd/system/

# Update backend service with database credentials
sed -i "s/DB_HOST=localhost/DB_HOST=$DB_HOST/g" /etc/systemd/system/dsr-backend.service
sed -i "s/DB_PORT=5432/DB_PORT=$DB_PORT/g" /etc/systemd/system/dsr-backend.service
sed -i "s/DB_NAME=dsr/DB_NAME=$DB_NAME/g" /etc/systemd/system/dsr-backend.service
sed -i "s/DB_USER=dsr/DB_USER=$DB_USER/g" /etc/systemd/system/dsr-backend.service
sed -i "s/DB_PASSWORD=changeme/DB_PASSWORD=$DB_PASSWORD/g" /etc/systemd/system/dsr-backend.service

# Configure event times
echo ""
echo "Configure event timing:"
read -p "Enter event start time (default: 18:00): " EVENT_START
EVENT_START=${EVENT_START:-18:00}
read -p "Enter event end time (default: 24:00): " EVENT_END
EVENT_END=${EVENT_END:-24:00}
read -p "Enter event timezone (default: UTC): " EVENT_TZ
EVENT_TZ=${EVENT_TZ:-UTC}

sed -i "s/EVENT_START_TIME=18:00/EVENT_START_TIME=$EVENT_START/g" /etc/systemd/system/dsr-backend.service
sed -i "s/EVENT_END_TIME=24:00/EVENT_END_TIME=$EVENT_END/g" /etc/systemd/system/dsr-backend.service
sed -i "s/EVENT_TIMEZONE=UTC/EVENT_TIMEZONE=$EVENT_TZ/g" /etc/systemd/system/dsr-backend.service

# Create log rotation config
cat > /etc/logrotate.d/dsr << EOF
$BACKEND_INSTALL_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 dsr dsr
    sharedscripts
    postrotate
        systemctl reload $BACKEND_SERVICE > /dev/null 2>&1 || true
    endscript
}
EOF

# Configure firewall
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 8080/tcp comment "DSR Backend API"
    ufw allow 8888/tcp comment "DSR HLS Streaming"
    ufw allow 19350/tcp comment "DSR RTMP Input"
    ufw allow 9997/tcp comment "MediaMTX API"
fi

# Reload systemd and start services
systemctl daemon-reload
systemctl enable "$BACKEND_SERVICE"
systemctl enable "$MEDIAMTX_SERVICE"
systemctl start "$MEDIAMTX_SERVICE"
systemctl start "$BACKEND_SERVICE"

echo ""
echo "Installation complete!"
echo "====================="
echo "Backend installed to: $BACKEND_INSTALL_DIR"
echo "MediaMTX installed to: $MEDIAMTX_INSTALL_DIR"
echo ""
echo "Services:"
echo "  - $BACKEND_SERVICE (API on port 8080)"
echo "  - $MEDIAMTX_SERVICE (RTMP on port 19350, HLS on port 8888)"
echo ""
echo "To check service status:"
echo "  systemctl status $BACKEND_SERVICE"
echo "  systemctl status $MEDIAMTX_SERVICE"
echo ""
echo "To view logs:"
echo "  journalctl -u $BACKEND_SERVICE -f"
echo "  journalctl -u $MEDIAMTX_SERVICE -f"
echo ""
echo "RTMP Publishing URL: rtmp://$(hostname -I | awk '{print $1}'):19350/stream"
echo "HLS Playback URL: http://$(hostname -I | awk '{print $1}'):8888/stream/index.m3u8"