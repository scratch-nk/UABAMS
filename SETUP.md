# UABAMS — Development Setup Guide

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Mosquitto MQTT broker
- Git

---

## 1. Clone and install dependencies

```bash
git clone https://github.com/RajdeepScripts/UABAMS.git
cd UABAMS/web/server
npm install
```

---

## 2. PostgreSQL setup

The project uses **PostgreSQL** as its primary database (migrated from CouchDB).

### Install PostgreSQL

```bash
sudo apt install postgresql
```

### Create database and user

```bash
sudo -u postgres psql -c "CREATE DATABASE uabams;"
sudo -u postgres psql -c "CREATE USER uabams_user WITH PASSWORD 'uabams123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE uabams TO uabams_user;"
sudo -u postgres psql -c "ALTER USER uabams_user SUPERUSER;"
```

### Find your PostgreSQL port

```bash
pg_lsclusters
```

The default port is usually `5432`. On some systems it may be `5433`. Note it down for the next step.

---

## 3. Environment variables

Create `web/server/.env` by copying the example:

```bash
cp web/server/.env.example web/server/.env
```

Then edit `web/server/.env` and fill in your values:

```env
# MQTT
MQTT_HOST=127.0.0.1
MQTT_PORT=1883

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432        # use 5433 if pg_lsclusters shows 5433
PG_DB=uabams
PG_USER=uabams_user
PG_PASSWORD=uabams123

# Server
PORT=5000
```

> **Note:** `.env` is gitignored — never commit it.

---

## 4. Database tables

Tables and indexes are created **automatically** when the server starts for the first time. You do not need to run any SQL manually.

On startup you should see:
```
PostgreSQL connected and schema ready
```

If you see an error instead, double-check your `PG_PORT` and that the `uabams` database exists.

---

## 5. Start the server

```bash
cd web/server
node server.js
```

Expected output:
```
Loaded N existing impact records from JSON fallback
[thresholds] Loaded: { p1Min: 5, p1Max: 10, ... }
PostgreSQL connected and schema ready
Server running on port 5000
Local IP: 192.168.x.x
Frontend: http://192.168.x.x:5000/index.html
PostgreSQL: localhost:5432/uabams
MQTT Connected to 127.0.0.1:1883
```

Then open `http://localhost:5000/index.html` in your browser.

---

## 6. Verify the database (optional)

Install pgAdmin for a GUI view of the database:

```bash
# Add pgAdmin repo
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg
sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list'
sudo apt update && sudo apt install pgadmin4-web -y
sudo /usr/pgadmin4/bin/setup-web.sh
```

Then open `http://localhost/pgadmin4` and connect with:
- Host: `localhost`
- Port: your PG port
- Database: `uabams`
- Username: `uabams_user`
- Password: `uabams123`

---

## 7. ARM toolchain (embedded only)

If you're building the STM32 firmware, install the ARM cross-compiler and set your local path in `embedded/Makefile`:

```makefile
export TOOLCHAIN_PREFIX ?= /your/local/path/gcc-arm-none-eabi-10.3-2021.10/bin/
```

This line is intentionally not committed — each developer sets their own local path.

---

## Common issues

| Error | Fix |
|---|---|
| `PostgreSQL init error: password authentication failed` | Check `PG_USER` and `PG_PASSWORD` in `.env` |
| `PostgreSQL init error: database "uabams" does not exist` | Run the CREATE DATABASE command in step 2 |
| `EADDRINUSE: port 5000` | Another process is using port 5000. Kill it: `pkill -f "node server.js"` |
| `Cannot find module 'pg'` | Run `npm install` inside `web/server/` |
| Tables not created | Check server logs for `PostgreSQL init error` — usually a credentials issue |
