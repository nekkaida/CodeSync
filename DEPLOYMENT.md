# CodeSync Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Database Migrations](#database-migrations)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js 22.x or higher
- PostgreSQL 16.x
- Redis 7.x
- MinIO or S3-compatible storage
- Docker & Docker Compose (for containerized deployment)
- Git

### Required Accounts (Optional)
- Docker Hub account (for container registry)
- Sentry account (for error tracking)
- SMTP service (for email notifications)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/codesync.git
cd codesync
```

### 2. Configure Environment Variables

**Backend (.env)**

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
NODE_ENV=production
PORT=4000
YJS_PORT=4001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/codesync

# Redis
REDIS_URL=redis://:password@localhost:6379

# Security (Generate strong secrets!)
JWT_SECRET=your-very-long-random-secret-min-32-characters
CSRF_SECRET=your-very-long-random-secret-min-32-characters
SESSION_SECRET=your-very-long-random-secret-min-32-characters

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# S3/MinIO Storage
S3_ENDPOINT=minio.yourdomain.com
S3_PORT=9000
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=codesync-files
S3_USE_SSL=true

# SMTP (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=CodeSync

# Frontend
FRONTEND_URL=https://yourdomain.com

# Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
```

**Frontend (.env.local)**

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
NEXT_PUBLIC_YJS_URL=wss://yjs.yourdomain.com
```

### 3. Generate Secure Secrets

```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Local Development

### 1. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, MinIO
docker-compose up -d postgres redis minio
```

### 2. Setup Database

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Seed database
npm run seed
```

### 3. Start Backend

```bash
# Development mode with hot reload
npm run dev

# Or start both API and Yjs servers
npm run dev:all
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Yjs Server: ws://localhost:4001
- MinIO Console: http://localhost:9001

## Production Deployment

### Option 1: Traditional VPS/Server Deployment

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. Setup PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE codesync;
CREATE USER codesync_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE codesync TO codesync_user;
\q
```

#### 3. Deploy Backend

```bash
# Clone and build
cd /var/www
git clone https://github.com/yourusername/codesync.git
cd codesync/backend

# Install dependencies (production only)
npm ci --only=production

# Generate Prisma Client
npx prisma generate

# Build TypeScript
npm run build

# Run migrations
npx prisma migrate deploy

# Start with PM2
pm2 start dist/index.js --name codesync-api
pm2 start dist/yjs-server.js --name codesync-yjs

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 4. Deploy Frontend

```bash
cd /var/www/codesync/frontend

# Install dependencies
npm ci --only=production

# Build Next.js
npm run build

# Start with PM2
pm2 start npm --name codesync-frontend -- start

pm2 save
```

#### 5. Configure Nginx

```nginx
# /etc/nginx/sites-available/codesync
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    # WebSocket (Socket.io)
    location /socket.io {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Yjs WebSocket
    location /yjs {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and setup SSL:

```bash
sudo ln -s /etc/nginx/sites-available/codesync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Option 2: Docker Deployment

#### 1. Build Images

```bash
# Build backend
cd backend
docker build -t yourusername/codesync-backend:latest .

# Build frontend
cd ../frontend
docker build -t yourusername/codesync-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_YJS_URL=wss://yjs.yourdomain.com \
  .
```

#### 2. Push to Registry (Optional)

```bash
docker login
docker push yourusername/codesync-backend:latest
docker push yourusername/codesync-frontend:latest
```

#### 3. Deploy with Docker Compose

```bash
# Create .env file with production values
cp .env.example .env
vim .env

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

#### 4. Verify Deployment

```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Test health endpoints
curl http://localhost:4000/health
curl http://localhost:3000/api/health
```

## Database Migrations

### Development

```bash
# Create new migration
cd backend
npx prisma migrate dev --name add_new_feature

# Reset database (warning: deletes data)
npx prisma migrate reset
```

### Production

```bash
# Apply pending migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Rollback (manual process - see MIGRATIONS.md)
```

See [MIGRATIONS.md](backend/MIGRATIONS.md) for detailed migration strategy.

## Monitoring

### Health Checks

- Backend: `GET /health`
- Frontend: `GET /api/health`
- Metrics: `GET /metrics` (Prometheus format)

### Logs

**PM2 Logs:**
```bash
pm2 logs codesync-api
pm2 logs codesync-yjs
pm2 logs codesync-frontend
```

**Docker Logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Performance Monitoring

- Set up Prometheus to scrape `/metrics` endpoint
- Configure Grafana dashboards for visualization
- Enable Sentry for error tracking

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U codesync_user -d codesync -h localhost

# Check DATABASE_URL format
echo $DATABASE_URL
```

### Redis Connection Errors

```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# Check Redis URL
echo $REDIS_URL
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :4000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Docker Issues

```bash
# Clean up Docker
docker-compose -f docker-compose.prod.yml down
docker system prune -a

# Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Permission Errors

```bash
# Fix file permissions
sudo chown -R $USER:$USER /var/www/codesync

# Fix npm global permissions
sudo chown -R $USER:$(id -gn $USER) ~/.npm
```

### Environment Variables Not Loading

```bash
# Check .env file exists
ls -la .env

# Verify format (no spaces around =)
cat .env | grep =

# Restart services after changes
pm2 restart all
# OR
docker-compose -f docker-compose.prod.yml restart
```

## Security Checklist

- [ ] Use strong, randomly generated secrets (min 32 characters)
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall (ufw/iptables)
- [ ] Regularly update dependencies (`npm audit`)
- [ ] Set up automated backups for PostgreSQL
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets (never commit .env)
- [ ] Enable Sentry for production error tracking
- [ ] Set up monitoring and alerts
- [ ] Review and rotate secrets periodically

## Backup Strategy

### Database Backup

```bash
# Create backup
pg_dump -U codesync_user codesync > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -U codesync_user codesync < backup_20240101_120000.sql

# Automated daily backups with cron
0 2 * * * pg_dump -U codesync_user codesync > /backups/codesync_$(date +\%Y\%m\%d).sql
```

### File Storage Backup

```bash
# Backup MinIO data
mc mirror minio/codesync-files /backups/minio/

# Restore MinIO data
mc mirror /backups/minio/ minio/codesync-files
```

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or HAProxy to distribute traffic
2. **Multiple Backend Instances**: Scale API servers behind load balancer
3. **Redis Cluster**: Use Redis Cluster for high availability
4. **Database Read Replicas**: Add PostgreSQL read replicas
5. **CDN**: Use CloudFlare or similar for static assets

### Vertical Scaling

1. Increase server resources (CPU, RAM, Disk)
2. Optimize database queries and indexes
3. Enable caching strategies
4. Use Redis for session storage

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/codesync/issues
- Documentation: https://docs.codesync.io
- Community: https://discord.gg/codesync
