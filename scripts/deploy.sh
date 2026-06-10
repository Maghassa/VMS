#!/bin/bash
set -e

echo "=== VMS Deploy ==="

# Copy .env
cp .env.example .env
echo "Edit /opt/vms/.env before continuing!"

# Install API deps & build
cd api
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build
cd ..

# Build frontend
cd frontend
npm ci
npm run build
cd ..

# Copy systemd units
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vms-ai vms-api vms-frontend
sudo systemctl start vms-ai vms-api vms-frontend

echo "=== Deploy complete ==="
sudo systemctl status vms-api --no-pager
