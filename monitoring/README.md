# CodeSync Monitoring Guide

## Overview

CodeSync uses a comprehensive monitoring stack to ensure system reliability and performance:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Alertmanager** - Alert routing and management
- **Sentry** - Error tracking and performance monitoring
- **Uptime Kuma** - Uptime monitoring and status page
- **Exporters** - System, database, and cache metrics

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start main application
docker-compose -f docker-compose.prod.yml up -d

# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Start uptime monitoring (optional)
docker-compose -f monitoring/uptime-kuma.docker-compose.yml up -d
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001
  - Default credentials: admin/admin (change on first login)
  - Pre-configured CodeSync dashboard available

- **Prometheus**: http://localhost:9090
  - Metrics explorer and query interface

- **Alertmanager**: http://localhost:9093
  - Alert status and silencing

- **Uptime Kuma**: http://localhost:3002
  - First-time setup required

## Prometheus Metrics

### Available Metrics

**HTTP Metrics:**
- `http_requests_total` - Total HTTP requests by method, path, status
- `http_request_duration_seconds` - Request duration histogram
- `http_request_size_bytes` - Request size histogram
- `http_response_size_bytes` - Response size histogram

**WebSocket Metrics:**
- `ws_connections_active` - Active WebSocket connections
- `ws_connections_total` - Total WebSocket connections
- `ws_messages_total` - Total WebSocket messages

**Application Metrics:**
- `sessions_active` - Active coding sessions
- `session_participants` - Participants per session
- `yjs_documents_active` - Active Yjs documents
- `yjs_operations_total` - Yjs operations by type
- `rate_limit_hits_total` - Rate limit hits by type

**System Metrics:**
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `process_heap_bytes` - Heap size
- `process_open_fds` - Open file descriptors

### Custom Metrics

You can add custom metrics in your code:

```typescript
import { register, Counter, Histogram } from '../utils/metrics';

// Counter
const myCounter = new Counter({
  name: 'my_custom_counter',
  help: 'Description of counter',
  labelNames: ['label1', 'label2'],
});

myCounter.inc({ label1: 'value1', label2: 'value2' });

// Histogram
const myHistogram = new Histogram({
  name: 'my_custom_histogram',
  help: 'Description of histogram',
  buckets: [0.1, 0.5, 1, 2, 5],
});

myHistogram.observe(1.5);
```

## Grafana Dashboards

### Pre-configured Dashboard

The CodeSync dashboard includes:
1. **Request Rate** - Requests per second
2. **Error Rate** - 5xx errors per second
3. **Response Time (p95)** - 95th percentile latency
4. **Active Connections** - WebSocket connections
5. **Active Sessions** - Coding sessions
6. **Memory Usage** - Backend memory consumption
7. **CPU Usage** - Backend CPU utilization
8. **Database Queries** - PostgreSQL transactions
9. **Redis Operations** - Cache operations
10. **Rate Limit Hits** - Rate limiting activity

### Creating Custom Dashboards

1. Go to Grafana → Dashboards → New Dashboard
2. Add Panel → Select visualization type
3. Write PromQL query in Query tab
4. Configure visualization options
5. Save dashboard

Example PromQL queries:

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active sessions
sessions_active

# Memory usage growth
rate(process_resident_memory_bytes[5m])
```

## Alertmanager Configuration

### Alert Routes

Alerts are routed based on severity:
- **Critical** - Immediate notification (email, Slack, PagerDuty)
- **Warning** - Batched notifications
- **Info** - Webhook only

### Configure Receivers

Edit `monitoring/alertmanager.yml`:

```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'ops@yourdomain.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@gmail.com'
        auth_password: 'your-app-password'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: 'CodeSync Alert'
```

Restart Alertmanager:
```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## Sentry Error Tracking

### Setup

1. Create account at https://sentry.io
2. Create new project "CodeSync"
3. Copy DSN from project settings
4. Add to `.env`:
   ```
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```
5. Restart backend

### Features

- **Error Tracking** - Automatic error capture
- **Performance Monitoring** - Transaction traces
- **Release Tracking** - Link errors to deployments
- **Breadcrumbs** - Context before errors
- **Source Maps** - Original code locations

### Manual Error Capture

```typescript
import { captureSentryException, captureSentryMessage } from '../utils/sentry';

try {
  // Your code
} catch (error) {
  captureSentryException(error, {
    userId: user.id,
    sessionId: session.id,
  });
}

// Log messages
captureSentryMessage('Important event occurred', 'info');
```

## Uptime Kuma Setup

### Initial Configuration

1. Access http://localhost:3002
2. Create admin account
3. Add monitors:

**Backend API Monitor:**
- Type: HTTP(s)
- URL: https://yourdomain.com/health
- Heartbeat Interval: 60 seconds
- Retries: 3

**Frontend Monitor:**
- Type: HTTP(s)
- URL: https://yourdomain.com/api/health
- Heartbeat Interval: 60 seconds
- Retries: 3

**Database Monitor:**
- Type: TCP Port
- Host: your-db-server
- Port: 5432
- Heartbeat Interval: 120 seconds

### Notifications

Configure notifications in Settings → Notifications:
- Email
- Slack
- Discord
- Telegram
- Webhook

### Status Page

Create public status page:
1. Status Pages → New Status Page
2. Add monitors to status page
3. Customize appearance
4. Share public URL

## Production Best Practices

### 1. Secure Access

```nginx
# Nginx config for Grafana
location /grafana/ {
    proxy_pass http://localhost:3001/;
    auth_basic "Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

### 2. Data Retention

Configure in `prometheus.yml`:
```yaml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 10GB
```

### 3. Backup Grafana

```bash
# Backup Grafana database
docker exec codesync-grafana \
  sqlite3 /var/lib/grafana/grafana.db ".backup /var/lib/grafana/grafana.db.backup"

docker cp codesync-grafana:/var/lib/grafana/grafana.db.backup ./grafana-backup.db
```

### 4. Alert Tuning

Review and adjust alert thresholds:
- High error rate: `> 0.05` (5%)
- High memory: `> 0.90` (90%)
- High CPU: `> 0.80` (80%)
- Response time: `> 2s` (p95)

### 5. Regular Review

- Weekly: Review dashboards for anomalies
- Monthly: Review alert rules and thresholds
- Quarterly: Review retention policies
- Yearly: Audit monitoring stack

## Troubleshooting

### Prometheus Not Scraping

Check targets: http://localhost:9090/targets

If backend is unhealthy:
- Verify METRICS_TOKEN is set
- Check backend logs: `docker logs codesync-backend`
- Test manually: `curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:4000/metrics`

### Grafana Connection Issues

```bash
# Check Prometheus datasource
docker logs codesync-grafana

# Verify network
docker network inspect codesync-network

# Restart Grafana
docker-compose -f docker-compose.monitoring.yml restart grafana
```

### High Memory Usage

```bash
# Check Prometheus memory
docker stats codesync-prometheus

# Reduce retention if needed
# Edit prometheus.yml and restart
```

### Missing Metrics

1. Check metric exists: http://localhost:9090/graph
2. Verify scrape interval in prometheus.yml
3. Check backend is exporting metric
4. Verify metric name spelling

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Uptime Kuma GitHub](https://github.com/louislam/uptime-kuma)
