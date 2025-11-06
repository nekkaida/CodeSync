#!/bin/bash

echo "🔐 Generating CodeSync secrets..."

# Generate strong passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
CSRF_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Root .env
cat > .env <<EOF
# Generated: $(date)
# DO NOT COMMIT TO GIT

POSTGRES_USER=codesync_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=codesync

REDIS_PASSWORD=${REDIS_PASSWORD}
EOF

# Backend .env
cat > backend/.env <<EOF
# Generated: $(date)
# DO NOT COMMIT TO GIT

NODE_ENV=development

# Database
DATABASE_URL=postgresql://codesync_user:${DB_PASSWORD}@localhost:5432/codesync?schema=public

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Authentication
JWT_SECRET=${JWT_SECRET}
CSRF_SECRET=${CSRF_SECRET}
SESSION_SECRET=${SESSION_SECRET}

# Server
PORT=4000
YJS_PORT=4001

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Cookies
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false

# OpenAI (ADD YOUR KEY)
OPENAI_API_KEY=sk-YOUR_KEY_HERE

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=codesync-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="CodeSync" <noreply@codesync.com>

# Logging
LOG_LEVEL=info

# Monitoring
SENTRY_DSN=

# Frontend
FRONTEND_URL=http://localhost:3000
EOF

# Frontend .env
cat > frontend/.env.local <<EOF
# Generated: $(date)

NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_YJS_URL=ws://localhost:4001
NEXT_PUBLIC_APP_NAME=CodeSync
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENV=development
EOF

# AI Service .env
cat > ai-service/.env <<EOF
# Generated: $(date)

# OpenAI
OPENAI_API_KEY=sk-YOUR_KEY_HERE

# Server
PORT=8000
HOST=0.0.0.0

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379

# Logging
LOG_LEVEL=info
EOF

echo "✅ Secrets generated!"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Add your OpenAI API key to backend/.env and ai-service/.env"
echo "2. Add your SMTP credentials to backend/.env"
echo "3. Never commit .env files to git"
echo ""
echo "Files created:"
echo "  - .env (root)"
echo "  - backend/.env"
echo "  - frontend/.env.local"
echo "  - ai-service/.env"
