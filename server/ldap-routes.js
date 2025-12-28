/**
 * LDAP API Routes
 * Endpoints for LDAP configuration, testing, and synchronization
 */

import express from 'express';
import LDAPConnector from './ldap-connector.js';
import LDAPSync from './ldap-sync.js';

const router = express.Router();

/**
 * Test LDAP connection
 * GET /api/ldap/test
 */
router.get('/test', async (req, res) => {
    try {
        // Check if LDAP is enabled
        if (process.env.LDAP_ENABLED !== 'true') {
            return res.json({
                success: false,
                message: 'LDAP is not enabled. Set LDAP_ENABLED=true in .env'
            });
        }

        const ldap = new LDAPConnector({});
        const result = await ldap.testConnection();

        // Log audit
        await req.app.locals.db.logAudit(
            req.user.id,
            req.user.username,
            'ldap_test',
            'ldap',
            null,
            result.success ? 'Connection test successful' : `Connection test failed: ${result.message}`,
            req.ip,
            req.get('user-agent')
        );

        res.json(result);
    } catch (error) {
        console.error('LDAP test error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Get LDAP configuration (without sensitive data)
 * GET /api/ldap/config
 */
router.get('/config', (req, res) => {
    const config = {
        enabled: process.env.LDAP_ENABLED === 'true',
        url: process.env.LDAP_URL || '',
        baseDN: process.env.LDAP_BASE_DN || '',
        userSearchBase: process.env.LDAP_USER_SEARCH_BASE || '',
        groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || '',
        autoSync: process.env.LDAP_AUTO_SYNC === 'true',
        syncInterval: parseInt(process.env.LDAP_SYNC_INTERVAL || '3600'),
        configured: !!(process.env.LDAP_URL && process.env.LDAP_BIND_DN && process.env.LDAP_BIND_PASSWORD)
    };

    res.json(config);
});

/**
 * Preview LDAP users (without importing)
 * GET /api/ldap/preview/users
 */
router.get('/preview/users', async (req, res) => {
    try {
        if (process.env.LDAP_ENABLED !== 'true') {
            return res.status(400).json({ error: 'LDAP is not enabled' });
        }

        const ldap = new LDAPConnector({});
        await ldap.connect();

        const users = await ldap.getUsers();
        await ldap.disconnect();

        // Log audit
        await req.app.locals.db.logAudit(
            req.user.id,
            req.user.username,
            'ldap_preview_users',
            'ldap',
            null,
            `Retrieved ${users.length} users from LDAP`,
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                dn: u.dn,
                isDisabled: u.isDisabled
            }))
        });
    } catch (error) {
        console.error('LDAP preview users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Preview LDAP groups (without importing)
 * GET /api/ldap/preview/groups
 */
router.get('/preview/groups', async (req, res) => {
    try {
        if (process.env.LDAP_ENABLED !== 'true') {
            return res.status(400).json({ error: 'LDAP is not enabled' });
        }

        const ldap = new LDAPConnector({});
        await ldap.connect();

        const groups = await ldap.getGroups();
        await ldap.disconnect();

        // Log audit
        await req.app.locals.db.logAudit(
            req.user.id,
            req.user.username,
            'ldap_preview_groups',
            'ldap',
            null,
            `Retrieved ${groups.length} groups from LDAP`,
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            count: groups.length,
            groups: groups.map(g => ({
                name: g.name,
                description: g.description,
                dn: g.dn,
                memberCount: g.members.length
            }))
        });
    } catch (error) {
        console.error('LDAP preview groups error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start LDAP synchronization
 * POST /api/ldap/sync
 * Body: { dryRun: boolean }
 */
router.post('/sync', async (req, res) => {
    try {
        if (process.env.LDAP_ENABLED !== 'true') {
            return res.status(400).json({ error: 'LDAP is not enabled' });
        }

        const { dryRun = false } = req.body;

        const ldapSync = new LDAPSync(req.app.locals.db);
        const result = await ldapSync.fullSync(req.user.id, dryRun);

        // Log audit
        await req.app.locals.db.logAudit(
            req.user.id,
            req.user.username,
            dryRun ? 'ldap_sync_dryrun' : 'ldap_sync',
            'ldap',
            null,
            `LDAP sync ${dryRun ? '(dry run)' : ''}: ${result.stats.usersAdded} users added, ${result.stats.groupsAdded} groups added`,
            req.ip,
            req.get('user-agent')
        );

        res.json(result);
    } catch (error) {
        console.error('LDAP sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get LDAP sync history
 * GET /api/ldap/sync/history
 */
router.get('/sync/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        
        const ldapSync = new LDAPSync(req.app.locals.db);
        const history = await ldapSync.getSyncHistory(limit);

        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('LDAP sync history error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get LDAP statistics
 * GET /api/ldap/stats
 */
router.get('/stats', async (req, res) => {
    try {
        // Count LDAP users and groups
        const ldapUsers = await req.app.locals.db.query('SELECT COUNT(*) as count FROM users WHERE is_ldap_user = TRUE');
        const ldapGroups = await req.app.locals.db.query('SELECT COUNT(*) as count FROM groups WHERE is_ldap_group = TRUE');
        const activeUsers = await req.app.locals.db.query('SELECT COUNT(*) as count FROM users WHERE is_ldap_user = TRUE AND is_active = TRUE');

        // Get last sync info
        const lastSync = await req.app.locals.db.query('SELECT * FROM ldap_sync_logs ORDER BY started_at DESC LIMIT 1');

        res.json({
            success: true,
            stats: {
                ldapUsers: ldapUsers[0]?.count || 0,
                ldapGroups: ldapGroups[0]?.count || 0,
                activeUsers: activeUsers[0]?.count || 0,
                lastSync: lastSync[0] || null
            }
        });
    } catch (error) {
        console.error('LDAP stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
