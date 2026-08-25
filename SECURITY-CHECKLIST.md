# Security Implementation Checklist

Use this checklist to ensure proper implementation of the database security patch.

## For Developers (Local Development)

### Initial Setup

- [ ] Read [QUICKSTART.md](QUICKSTART.md) for setup instructions
- [ ] Copy `.env.example` to `.env`
- [ ] Generate strong passwords:
  ```bash
  openssl rand -base64 32  # For POSTGRES_SUPERUSER_PASSWORD
  openssl rand -base64 32  # For POSTGRES_APP_PASSWORD
  openssl rand -base64 64  # For JWT_SECRET
  ```
- [ ] Update `.env` with generated passwords
- [ ] Update `DATABASE_URL` in `.env` with your `POSTGRES_APP_PASSWORD`
- [ ] Update `MIGRATION_DATABASE_URL` in `.env` with your `POSTGRES_SUPERUSER_PASSWORD`
- [ ] Verify `.env` is in `.gitignore` (it should be)
- [ ] Never commit your `.env` file

### Database Setup

- [ ] Start database: `npm run db:up`
- [ ] Verify database is healthy: `docker ps` (should show "healthy")
- [ ] Run migrations: `npm run db:setup`
- [ ] Verify application user exists:
  ```bash
  docker exec -it campusvote_db psql -U postgres -d campusvote_db -c "\du"
  ```
- [ ] Test application connection:
  ```bash
  docker exec -it campusvote_db psql -U campusvote_app -d campusvote_db -c "SELECT 1;"
  ```

### Application Testing

- [ ] Start application: `npm run dev`
- [ ] Test health endpoint: `curl http://localhost:3000/api/health`
- [ ] Verify no "permission denied" errors in logs
- [ ] Test API endpoints via Swagger: `http://localhost:3000/api/docs`
- [ ] Run test suite: `npm test`

### Security Verification

- [ ] Verify database is NOT accessible from external networks:
  ```bash
  # From another machine (should fail)
  psql -h <your-ip> -p 5433 -U postgres -d campusvote_db
  ```
- [ ] Verify application user has limited privileges:
  ```bash
  # Should fail (no DROP privilege)
  docker exec -it campusvote_db psql -U campusvote_app -d campusvote_db -c "DROP TABLE users;"
  ```
- [ ] Verify superuser is NOT used by application:
  ```bash
  # Check application logs - should show connections from campusvote_app, not postgres
  docker logs campusvote_db | grep "connection authorized"
  ```

## For DevOps/SRE (Production Deployment)

### Pre-Deployment

- [ ] Read [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md)
- [ ] Read [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)
- [ ] Schedule maintenance window
- [ ] Notify stakeholders of deployment
- [ ] Test migration in staging environment
- [ ] Prepare rollback plan

### Secrets Management

- [ ] Choose secrets management solution (AWS Secrets Manager, Vault, etc.)
- [ ] Generate strong production passwords:
  ```bash
  openssl rand -base64 32  # For POSTGRES_SUPERUSER_PASSWORD
  openssl rand -base64 32  # For POSTGRES_APP_PASSWORD
  openssl rand -base64 64  # For JWT_SECRET
  ```
- [ ] Store passwords in secrets manager
- [ ] Document secret names and access procedures
- [ ] Set up secret rotation policy
- [ ] Configure application to retrieve secrets
- [ ] Test secret retrieval in staging

### Backup

- [ ] Create full database backup before migration
- [ ] Verify backup integrity
- [ ] Store backup in secure location (encrypted)
- [ ] Document backup location and restoration procedure
- [ ] Test backup restoration in staging

### Network Security

- [ ] Review port binding configuration
- [ ] Consider removing `ports` section (use Docker networks)
- [ ] Configure firewall rules
- [ ] Implement network segmentation
- [ ] Set up VPN/bastion host for database access if needed
- [ ] Document network architecture

### SSL/TLS Configuration

- [ ] Generate or obtain SSL certificates
- [ ] Configure PostgreSQL for SSL
- [ ] Update connection strings with `sslmode=require`
- [ ] Test SSL connections
- [ ] Set up certificate rotation

### Deployment

- [ ] Pull latest code with security patches
- [ ] Update docker-compose.yml with production configuration
- [ ] Set all required environment variables
- [ ] Stop application (prevent new writes)
- [ ] Create application user in existing database (if keeping data)
- [ ] Update database configuration
- [ ] Restart database with new configuration
- [ ] Verify database health
- [ ] Update application configuration
- [ ] Start application
- [ ] Monitor logs for errors

### Post-Deployment Verification

- [ ] Test health endpoint
- [ ] Verify database connectivity
- [ ] Test user authentication
- [ ] Test all critical API endpoints
- [ ] Verify no permission errors in logs
- [ ] Check database connection pool
- [ ] Monitor performance metrics
- [ ] Verify backups are working
- [ ] Test monitoring and alerting

### Security Audit

- [ ] Verify database is not exposed to public internet
- [ ] Verify application uses non-superuser account
- [ ] Verify SSL/TLS is enabled
- [ ] Verify strong passwords are in use
- [ ] Verify secrets are not in source control
- [ ] Verify firewall rules are correct
- [ ] Review database audit logs
- [ ] Check for failed authentication attempts
- [ ] Verify connection limits are configured
- [ ] Test privilege separation

### Documentation

- [ ] Document production configuration
- [ ] Update runbooks with new procedures
- [ ] Document secret locations and access
- [ ] Update disaster recovery procedures
- [ ] Document rollback procedures
- [ ] Update team training materials

### Monitoring and Alerting

- [ ] Set up database connection monitoring
- [ ] Set up failed authentication alerts
- [ ] Set up performance monitoring
- [ ] Set up disk usage alerts
- [ ] Set up backup success/failure alerts
- [ ] Configure log aggregation
- [ ] Set up security event alerts
- [ ] Test all alerts

## For Security Team

### Security Review

- [ ] Review all code changes
- [ ] Verify no hardcoded credentials
- [ ] Verify proper privilege separation
- [ ] Review network configuration
- [ ] Review secrets management implementation
- [ ] Verify SSL/TLS configuration
- [ ] Review backup encryption
- [ ] Check for information disclosure

### Penetration Testing

- [ ] Test external database access (should be blocked)
- [ ] Test with default credentials (should fail)
- [ ] Test privilege escalation (should be blocked)
- [ ] Test SQL injection (should be prevented)
- [ ] Test connection exhaustion
- [ ] Test backup security
- [ ] Document findings

### Compliance

- [ ] Verify compliance with OWASP guidelines
- [ ] Verify compliance with CWE-798 (no hardcoded credentials)
- [ ] Verify compliance with CWE-250 (least privilege)
- [ ] Verify compliance with organizational policies
- [ ] Document compliance status
- [ ] Update security documentation

### Ongoing Security

- [ ] Schedule regular password rotation
- [ ] Schedule regular security audits
- [ ] Schedule penetration testing
- [ ] Monitor security advisories
- [ ] Plan security updates
- [ ] Review access logs regularly

## For Project Managers

### Planning

- [ ] Review security requirements
- [ ] Allocate time for migration
- [ ] Schedule maintenance window
- [ ] Communicate with stakeholders
- [ ] Plan rollback procedures
- [ ] Budget for secrets management solution

### Communication

- [ ] Notify users of maintenance window
- [ ] Communicate security improvements
- [ ] Update project documentation
- [ ] Train team on new procedures
- [ ] Document lessons learned

### Post-Implementation

- [ ] Verify all teams are trained
- [ ] Update project security status
- [ ] Schedule follow-up security review
- [ ] Document any issues encountered
- [ ] Plan for ongoing security improvements

## Emergency Contacts

Document your emergency contacts:

- [ ] Database Administrator: _______________
- [ ] Security Team Lead: _______________
- [ ] DevOps On-Call: _______________
- [ ] Application Owner: _______________
- [ ] Incident Response Team: _______________

## Rollback Criteria

Rollback if:

- [ ] Application cannot connect to database
- [ ] Critical functionality is broken
- [ ] Performance degradation > 50%
- [ ] Data integrity issues detected
- [ ] Security issues introduced
- [ ] Unable to resolve issues within maintenance window

## Success Criteria

Deployment is successful when:

- [ ] Application is running without errors
- [ ] All API endpoints are functional
- [ ] Database connections are working
- [ ] No permission denied errors
- [ ] Performance is acceptable
- [ ] Monitoring is working
- [ ] Backups are successful
- [ ] Security verification passed
- [ ] Team is trained on new procedures
- [ ] Documentation is updated

## Timeline

Recommended timeline:

- **Week 1**: Planning and preparation
  - Review documentation
  - Test in development
  - Plan migration strategy

- **Week 2**: Staging deployment
  - Deploy to staging
  - Test thoroughly
  - Document issues

- **Week 3**: Production preparation
  - Set up secrets management
  - Configure monitoring
  - Prepare backups

- **Week 4**: Production deployment
  - Execute migration
  - Monitor closely
  - Document results

- **Week 5+**: Post-deployment
  - Ongoing monitoring
  - Team training
  - Security audit

## Notes

Use this space to document environment-specific information:

```
Environment: _______________
Deployment Date: _______________
Deployed By: _______________
Issues Encountered: _______________
Resolution: _______________
```

## Sign-off

- [ ] Developer Lead: _______________ Date: _______________
- [ ] DevOps Lead: _______________ Date: _______________
- [ ] Security Lead: _______________ Date: _______________
- [ ] Project Manager: _______________ Date: _______________
