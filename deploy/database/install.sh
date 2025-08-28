#!/bin/bash

set -e

echo "DSR Database (PostgreSQL) Installation Script for Ubuntu"
echo "======================================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Variables
PG_VERSION="17"
DB_NAME="dsr"
DB_USER="dsr"
CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"
DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"
BACKUP_DIR="/var/backups/postgresql"

# Check if PostgreSQL is already installed
if systemctl is-active --quiet postgresql; then
    echo "PostgreSQL is already installed and running."
    read -p "Do you want to continue with DSR database setup? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 0
    fi
else
    # Add PostgreSQL APT repository
    echo "Adding PostgreSQL APT repository..."
    apt-get update
    apt-get install -y wget ca-certificates
    
    # Create the repository configuration file
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    
    # Import the repository signing key
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    
    # Update package list
    apt-get update
    
    # Install PostgreSQL
    echo "Installing PostgreSQL $PG_VERSION..."
    apt-get install -y postgresql-$PG_VERSION postgresql-client-$PG_VERSION postgresql-contrib-$PG_VERSION
fi

# Set password for dsr user
read -s -p "Enter password for database user 'dsr': " DB_PASSWORD
echo
read -s -p "Confirm password: " DB_PASSWORD_CONFIRM
echo

if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
    echo "Passwords do not match!"
    exit 1
fi

# Update init script with password
sed -i "s/changeme/$DB_PASSWORD/g" init-database.sql

# Initialize database
echo "Initializing DSR database..."
sudo -u postgres psql < init-database.sql

# Backup original configuration files
echo "Backing up PostgreSQL configuration files..."
cp "$CONFIG_DIR/postgresql.conf" "$CONFIG_DIR/postgresql.conf.backup"
cp "$CONFIG_DIR/pg_hba.conf" "$CONFIG_DIR/pg_hba.conf.backup"

# Configure PostgreSQL for production
echo "Configuring PostgreSQL for production use..."
echo ""
echo "Current system resources:"
echo "  Total RAM: $(free -h | awk '/^Mem:/ {print $2}')"
echo "  CPU cores: $(nproc)"
echo ""
read -p "Apply recommended production settings? (y/n): " APPLY_PROD
if [[ "$APPLY_PROD" =~ ^[Yy]$ ]]; then
    # Calculate memory settings based on available RAM
    TOTAL_RAM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
    
    # Set shared_buffers to 25% of RAM
    SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))
    # Set effective_cache_size to 75% of RAM
    EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))
    
    # Apply settings
    sed -i "s/^#*shared_buffers.*/shared_buffers = ${SHARED_BUFFERS}MB/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*effective_cache_size.*/effective_cache_size = ${EFFECTIVE_CACHE}MB/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*listen_addresses.*/listen_addresses = '*'/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*log_min_duration_statement.*/log_min_duration_statement = 1000/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*log_checkpoints.*/log_checkpoints = on/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*log_connections.*/log_connections = on/" "$CONFIG_DIR/postgresql.conf"
    sed -i "s/^#*log_disconnections.*/log_disconnections = on/" "$CONFIG_DIR/postgresql.conf"
fi

# Configure client authentication
echo ""
echo "Configure PostgreSQL client authentication:"
echo "1. Local connections only (most secure)"
echo "2. Allow specific IP addresses"
echo "3. Allow subnet range"
read -p "Select option (1-3): " AUTH_OPTION

case $AUTH_OPTION in
    1)
        echo "Configuring for local connections only..."
        ;;
    2)
        read -p "Enter backend server IP addresses (comma-separated): " BACKEND_IPS
        IFS=',' read -ra IPS <<< "$BACKEND_IPS"
        echo "" >> "$CONFIG_DIR/pg_hba.conf"
        echo "# DSR backend servers" >> "$CONFIG_DIR/pg_hba.conf"
        for ip in "${IPS[@]}"; do
            ip=$(echo "$ip" | xargs)  # Trim whitespace
            echo "host    $DB_NAME    $DB_USER    $ip/32    scram-sha-256" >> "$CONFIG_DIR/pg_hba.conf"
        done
        ;;
    3)
        read -p "Enter subnet (e.g., 10.0.0.0/24): " SUBNET
        echo "" >> "$CONFIG_DIR/pg_hba.conf"
        echo "# DSR backend subnet" >> "$CONFIG_DIR/pg_hba.conf"
        echo "host    $DB_NAME    $DB_USER    $SUBNET    scram-sha-256" >> "$CONFIG_DIR/pg_hba.conf"
        ;;
esac

# Configure firewall
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
    case $AUTH_OPTION in
        1)
            # No firewall rule needed for local only
            ;;
        2)
            for ip in "${IPS[@]}"; do
                ip=$(echo "$ip" | xargs)
                ufw allow from "$ip" to any port 5432 comment "PostgreSQL for DSR"
            done
            ;;
        3)
            ufw allow from "$SUBNET" to any port 5432 comment "PostgreSQL for DSR"
            ;;
    esac
fi

# Create backup directory
echo "Setting up backup directory..."
mkdir -p "$BACKUP_DIR"
chown postgres:postgres "$BACKUP_DIR"

# Create backup script
cat > /usr/local/bin/dsr-db-backup << 'EOF'
#!/bin/bash
# DSR Database Backup Script

BACKUP_DIR="/var/backups/postgresql"
DB_NAME="dsr"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dsr_backup_$DATE.sql.gz"

# Perform backup
sudo -u postgres pg_dump $DB_NAME | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "dsr_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /usr/local/bin/dsr-db-backup

# Create cron job for daily backups
echo "Setting up daily backup cron job..."
echo "0 2 * * * root /usr/local/bin/dsr-db-backup > /var/log/dsr-db-backup.log 2>&1" > /etc/cron.d/dsr-db-backup

# Create monitoring script
cat > /usr/local/bin/dsr-db-status << 'EOF'
#!/bin/bash
# DSR Database Status Check

echo "DSR Database Status"
echo "=================="
echo ""
echo "PostgreSQL Service:"
systemctl status postgresql --no-pager | grep -E "(Active:|Main PID:)"
echo ""
echo "Database Size:"
sudo -u postgres psql -d dsr -c "SELECT pg_size_pretty(pg_database_size('dsr'));" -t
echo ""
echo "Active Connections:"
sudo -u postgres psql -d dsr -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'dsr';" -t
echo ""
echo "Current Reservations:"
sudo -u postgres psql -d dsr -c "SELECT COUNT(*) FROM reservations WHERE end_time > CURRENT_TIMESTAMP;" -t
echo ""
echo "Disk Usage:"
df -h "$DATA_DIR"
EOF

chmod +x /usr/local/bin/dsr-db-status

# Restart PostgreSQL
systemctl restart postgresql

# Verify installation
echo ""
echo "Verifying installation..."
sudo -u postgres psql -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    exit 1
fi

echo ""
echo "Installation complete!"
echo "====================="
echo "Database: $DB_NAME"
echo "Username: $DB_USER"
echo "Password: [as configured]"
echo "Port: 5432"
echo ""
echo "Configuration files:"
echo "  PostgreSQL config: $CONFIG_DIR/postgresql.conf"
echo "  Authentication: $CONFIG_DIR/pg_hba.conf"
echo ""
echo "Useful commands:"
echo "  Check status: dsr-db-status"
echo "  Manual backup: dsr-db-backup"
echo "  View logs: journalctl -u postgresql -f"
echo "  Connect to DB: sudo -u postgres psql -d $DB_NAME"
echo ""
echo "Connection string for backend:"
echo "  postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "IMPORTANT: Save the database password securely!"