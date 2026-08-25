# Production Deployment Guide

This guide provides security-focused recommendations for deploying CampusVote in production environments.

## Critical Security Requirements

### 1. Database Security

#### Remove Port Exposure

For production, **do not expose the PostgreSQL port** to the host. Instead, use Docker's internal networking:

**Option A: Remove port binding entirely (Recommended)**

Edit `docker-compose.yml` and remove the `ports` section:

```yaml
services:
  db:
    # ... other config ...
    # ports:  # REMOVE THIS SECTION
    #   - '127.0.0.1:5433:5432'
```

Then configure your application to connect via Docker network:

```env
DATABASE_URL="postgresql://campusvote_app:${POSTGRES_APP_PASSWORD}@db:5432/campusvote_db?schema=public"
```

**Option B: Use Docker Compose with application service**

Create a complete docker-compose.yml with both database and application:

```yaml
services:
  db:
    image: postgres:16-alpine
    # ... existing db config without ports section ...
    networks:
      - campusvote-network
  
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://campusvote_app:${POSTGRES_APP_PASSWORD}@db:5432/campusvote_db?schema=public
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - campusvote-network

networks:
  campusvote-network:
    driver: bridge
```

#### Use Strong, Unique Passwords

Generate cryptographically secure passwords:

```bash
# Generate strong passwords (32 bytes = 256 bits)
openssl rand -base64 32  # For POSTGRES_SUPERUSER_PASSWORD
openssl rand -base64 32  # For POSTGRES_APP_PASSWORD
openssl rand -base64 64  # For JWT_SECRET (longer for JWT)
```

**Never use:**
- Default passwords
- Dictionary words
- Passwords from examples or documentation
- The same password across environments

#### Implement Secrets Management

**AWS Secrets Manager:**
```bash
# Store secrets
aws secretsmanager create-secret \
  --name campusvote/db/superuser-password \
  --secret-string "your-generated-password"

# Retrieve in deployment
export POSTGRES_SUPERUSER_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id campusvote/db/superuser-password \
  --query SecretString --output text)
```

**HashiCorp Vault:**
```bash
# Store secrets
vault kv put secret/campusvote/db \
  superuser_password="your-generated-password" \
  app_password="your-generated-password"

# Retrieve in deployment
export POSTGRES_SUPERUSER_PASSWORD=$(vault kv get -field=superuser_password secret/campusvote/db)
```

**Docker Secrets (Docker Swarm):**
```bash
# Create secrets
echo "your-generated-password" | docker secret create postgres_superuser_password -
echo "your-generated-password" | docker secret create postgres_app_password -

# Use in docker-compose.yml
services:
  db:
    secrets:
      - postgres_superuser_password
      - postgres_app_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_superuser_password

secrets:
  postgres_superuser_password:
    external: true
  postgres_app_password:
    external: true
```

**Kubernetes Secrets:**
```bash
# Create secrets
kubectl create secret generic campusvote-db-secrets \
  --from-literal=superuser-password='your-generated-password' \
  --from-literal=app-password='your-generated-password'

# Reference in deployment
env:
  - name: POSTGRES_SUPERUSER_PASSWORD
    valueFrom:
      secretKeyRef:
        name: campusvote-db-secrets
        key: superuser-password
```

### 2. Enable SSL/TLS for Database Connections

#### Configure PostgreSQL for SSL

Create SSL certificates:

```bash
# Generate self-signed certificate (for testing)
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key \
  -subj "/CN=campusvote-db"

chmod 600 server.key
```

Update `docker-compose.yml`:

```yaml
services:
  db:
    # ... existing config ...
    volumes:
      - ./certs/server.crt:/var/lib/postgresql/server.crt:ro
      - ./certs/server.key:/var/lib/postgresql/server.key:ro
    command: >
      postgres
      -c ssl=on
      -c ssl_cert_file=/var/lib/postgresql/server.crt
      -c ssl_key_file=/var/lib/postgresql/server.key
```

Update connection strings:

```env
DATABASE_URL="postgresql://campusvote_app:${POSTGRES_APP_PASSWORD}@db:5432/campusvote_db?schema=public&sslmode=require"
```

### 3. Network Security

#### Firewall Rules

Ensure only necessary ports are exposed:

```bash
# Example using ufw (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# PostgreSQL port should NOT be allowed from external networks
```

#### Network Segmentation

Use separate networks for different components:

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access

services:
  app:
    networks:
      - frontend
      - backend
  
  db:
    networks:
      - backend  # Only accessible from backend network
```

### 4. Application Security

#### Environment Variables

Never commit production `.env` files. Use environment-specific configuration:

```bash
# .env.production (NOT committed to git)
NODE_ENV=production
DATABASE_URL=postgresql://...  # From secrets manager
JWT_SECRET=...  # From secrets manager
```

#### JWT Configuration

Use strong JWT secrets and appropriate expiration:

```env
JWT_SECRET=<64-character-random-string>
JWT_EXPIRES_IN=15m  # Short-lived access tokens
JWT_REFRESH_EXPIRES_IN=7d  # Longer refresh tokens
```

#### CORS Configuration

Restrict CORS to your frontend domain:

```env
CORS_ORIGIN=https://yourdomain.com
```

### 5. Database Hardening

#### Connection Pooling

Configure connection limits to prevent resource exhaustion:

```javascript
// In your database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Enable Audit Logging

Configure PostgreSQL to log all connections and queries:

```sql
-- In PostgreSQL configuration
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
SELECT pg_reload_conf();
```

#### Regular Backups

Implement automated backups:

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/campusvote_$TIMESTAMP.sql.gz"

# Backup using pg_dump
docker exec campusvote_db pg_dump -U postgres -d campusvote_db | gzip > "$BACKUP_FILE"

# Encrypt the backup
gpg --encrypt --recipient your-key-id "$BACKUP_FILE"

# Upload to secure storage (e.g., S3)
aws s3 cp "$BACKUP_FILE.gpg" s3://your-backup-bucket/

# Clean up old backups (keep last 30 days)
find "$BACKUP_DIR" -name "campusvote_*.sql.gz*" -mtime +30 -delete
```

Schedule with cron:
```cron
0 2 * * * /path/to/backup-db.sh
```

### 6. Monitoring and Alerting

#### Database Monitoring

Monitor key metrics:
- Connection count
- Query performance
- Disk usage
- Failed authentication attempts
- Unusual query patterns

#### Application Monitoring

Implement logging and monitoring:

```javascript
// Example with Winston
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log security events
logger.warn('Failed login attempt', { 
  user: username, 
  ip: req.ip,
  timestamp: new Date()
});
```

### 7. Deployment Checklist

Before deploying to production:

- [ ] All default passwords changed
- [ ] Secrets stored in a secrets manager
- [ ] Database port not exposed to public internet
- [ ] SSL/TLS enabled for database connections
- [ ] Firewall rules configured
- [ ] Network segmentation implemented
- [ ] CORS restricted to frontend domain
- [ ] JWT secrets are strong and unique
- [ ] Connection pooling configured
- [ ] Database audit logging enabled
- [ ] Automated backups configured
- [ ] Backup encryption enabled
- [ ] Monitoring and alerting set up
- [ ] Security headers configured (Helmet.js)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled
- [ ] Regular security updates scheduled

### 8. Incident Response

Prepare for security incidents:

1. **Detection**: Monitor logs for suspicious activity
2. **Containment**: Have procedures to quickly isolate compromised systems
3. **Investigation**: Preserve logs and evidence
4. **Recovery**: Have tested backup restoration procedures
5. **Post-Incident**: Document and learn from incidents

### 9. Regular Maintenance

Schedule regular security maintenance:

- **Weekly**: Review access logs for anomalies
- **Monthly**: Update dependencies (`npm audit fix`)
- **Quarterly**: Rotate database passwords
- **Annually**: Security audit and penetration testing

### 10. Compliance Considerations

Depending on your jurisdiction and use case, consider:

- **GDPR**: Data protection and privacy requirements
- **FERPA**: Student data protection (if applicable)
- **SOC 2**: Security controls and auditing
- **ISO 27001**: Information security management

## Example Production Deployment

### Using Docker Compose with Secrets

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: campusvote_db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/db_superuser_password
      POSTGRES_DB: campusvote_db
      POSTGRES_APP_USER: campusvote_app
      POSTGRES_APP_PASSWORD_FILE: /run/secrets/db_app_password
    secrets:
      - db_superuser_password
      - db_app_password
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d campusvote_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL_FILE: /run/secrets/database_url
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    secrets:
      - database_url
      - jwt_secret
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
      - frontend

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    networks:
      - frontend

secrets:
  db_superuser_password:
    external: true
  db_app_password:
    external: true
  database_url:
    external: true
  jwt_secret:
    external: true

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  db_data:
```

Deploy:

```bash
# Create secrets
echo "your-superuser-password" | docker secret create db_superuser_password -
echo "your-app-password" | docker secret create db_app_password -
echo "postgresql://campusvote_app:your-app-password@db:5432/campusvote_db" | docker secret create database_url -
echo "your-jwt-secret" | docker secret create jwt_secret -

# Deploy
docker stack deploy -c docker-compose.prod.yml campusvote
```

## Support

For security issues, please report privately to the security team rather than creating public issues.

For deployment questions, consult:
- [SECURITY-DATABASE.md](SECURITY-DATABASE.md) - Database security details
- [README.md](README.md) - General setup instructions
- [QUICKSTART.md](QUICKSTART.md) - Development setup
