# Security Guidelines for New Installations

## First Installation Checklist

When deploying AuthDrop for the first time, follow these security best practices:

### 1. Change Default Credentials

**Before starting the server for the first time:**

1. Copy `.env.example` to `.env`
2. **Change ALL default passwords:**
   - `SUPER_ADMIN_PASSWORD` - Use a strong, unique password
   - `DB_PASSWORD` / `POSTGRES_PASSWORD` - Use a strong, unique password
3. Consider changing the default username `SUPER_ADMIN_USERNAME` to something less predictable

### 2. Secure Your .env File

- **Never commit `.env` to git** (already in `.gitignore`)
- Set proper file permissions: `chmod 600 .env` (Linux/Mac)
- Keep backups in a secure location (password manager, encrypted storage)

### 3. Database Security

**PostgreSQL:**
- Use strong passwords (minimum 16 characters, mixed case, numbers, symbols)
- If exposed to network, use firewall rules to restrict access
- Consider using SSL/TLS for database connections
- Regularly backup your database

**Docker:**
- Don't expose PostgreSQL port (5432) to the host unless necessary
- Use Docker secrets for sensitive data in production
- Regularly update Docker images

### 4. After First Login

1. Log in with the super admin credentials from `.env`
2. **Immediately change the password** through the web interface
3. Create additional admin users if needed
4. Set up appropriate user groups and permissions

### 5. Clean Installation Verification

To ensure a clean installation with no old data:

**Docker Compose:**
```bash
docker compose down -v  # Remove all volumes
docker compose up -d    # Start fresh
```

**Manual PostgreSQL:**
```bash
node reset-postgres.js  # Resets database to clean state
```

**Important:** These commands will delete ALL existing data!

### 6. Network Security

- Use HTTPS in production (reverse proxy with Let's Encrypt)
- Configure firewall rules to restrict access
- Consider VPN or IP whitelisting for admin access
- Review audit logs regularly

### 7. Regular Maintenance

- Keep Node.js and dependencies updated: `npm update`
- Monitor audit logs for suspicious activity
- Regularly review user accounts and permissions
- Backup database regularly
- Test restore procedures

## Production Deployment Recommendations

1. **Use environment-specific .env files:**
   - `.env.development`
   - `.env.production`
   
2. **Enable audit logging** to track all admin actions

3. **Set up monitoring** for:
   - Failed login attempts
   - Database errors
   - Unusual activity patterns

4. **Document your setup:**
   - Server configuration
   - Backup procedures
   - Recovery procedures
   - Admin contacts

## Emergency Procedures

### Forgot Super Admin Password

If you lose access to the super admin account:

1. Stop the server
2. Run `node reset-postgres.js` (will reset database - **DATA LOSS**)
3. Or manually reset password in database:
   ```sql
   UPDATE users 
   SET password_hash = '$2b$10$...' 
   WHERE username = 'admin';
   ```

### Suspected Security Breach

1. Immediately change all passwords
2. Review audit logs for suspicious activity
3. Check for unauthorized users or permissions
4. Consider resetting database and restoring from backup
5. Update all software components
6. Review firewall and access logs

## Support

For security issues, please contact the repository maintainer privately before public disclosure.
