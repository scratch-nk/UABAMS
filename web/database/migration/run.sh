#!/bin/bash

# ─────────────────────────────────────────────
# Railway Monitoring — Database Setup Script
# ─────────────────────────────────────────────

DB_HOST=localhost
DB_PORT=5433
DB_NAME=railway_monitoring
DB_USER=admin
DB_PASSWORD=admin123

export PGPASSWORD=$DB_PASSWORD

echo "==> Checking if user '$DB_USER' exists..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")

if [ "$USER_EXISTS" != "1" ]; then
  echo "==> Creating user '$DB_USER'..."
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
  echo "==> User '$DB_USER' already exists, skipping."
fi

echo "==> Checking if database '$DB_NAME' exists..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [ "$DB_EXISTS" != "1" ]; then
  echo "==> Creating database '$DB_NAME'..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
else
  echo "==> Database '$DB_NAME' already exists, skipping."
fi

echo "==> Granting privileges to '$DB_USER' on '$DB_NAME'..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Grant superuser-level access needed for TimescaleDB extension creation
echo "==> Granting superuser to '$DB_USER' temporarily for extension setup..."
sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"

echo "==> Running schema migration: 001_initial_schema.sql..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/001_initial_schema.sql"

if [ $? -eq 0 ]; then
  echo "==> Schema applied successfully."
else
  echo "ERROR: Schema migration failed. Check the output above."
  exit 1
fi

# Optional: revoke superuser after setup if you want tighter security
# echo "==> Revoking superuser from '$DB_USER'..."
# sudo -u postgres psql -c "ALTER USER $DB_USER NOSUPERUSER;"

echo ""
echo "✅ Database setup complete!"
echo "   Host:     $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User:     $DB_USER"
