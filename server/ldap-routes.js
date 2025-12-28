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
        if (req.user) {
            await req.app.locals.db.logAction(
                req.user.id,
                req.user.username,
                'ldap_test',
                'ldap',
                null,
                result.success ? 'Test connessione LDAP riuscito' : `Test connessione LDAP fallito: ${result.message}`,
                req.ip,
                req.get('user-agent')
            );
        }

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

        // Get all groups
        const allLdapGroups = await ldap.getGroups();

        // Get parent group name from filter
        const groupFilter = process.env.LDAP_GROUP_SEARCH_FILTER || '';
        const parentGroupMatch = groupFilter.match(/CN=([^,)]+)/);
        const parentGroupName = parentGroupMatch ? parentGroupMatch[1] : null;

        // Filter to get only subgroups (exclude parent)
        const subgroups = allLdapGroups.filter(g => !parentGroupName || g.name !== parentGroupName);

        // Collect unique users from subgroups
        const uniqueUsers = new Map();
        const userGroupMap = new Map(); // Track which groups each user belongs to

        for (const ldapGroup of subgroups) {
            if (ldapGroup.members && ldapGroup.members.length > 0) {
                for (const memberDN of ldapGroup.members) {
                    try {
                        const user = await ldap.getUserByDN(memberDN);
                        if (user) {
                            if (!uniqueUsers.has(user.username)) {
                                uniqueUsers.set(user.username, user);
                                userGroupMap.set(user.username, []);
                            }
                            userGroupMap.get(user.username).push(ldapGroup.name);
                        }
                    } catch (error) {
                        // Skip users that can't be retrieved
                    }
                }
            }
        }

        const users = Array.from(uniqueUsers.values());
        await ldap.disconnect();

        // Log audit
        if (req.user) {
            await req.app.locals.db.logAction(
                req.user.id,
                req.user.username,
                'ldap_preview_users',
                'ldap',
                null,
                `Anteprima ${users.length} utenti da ${subgroups.length} sottogruppi LDAP`,
                req.ip,
                req.get('user-agent')
            );
        }

        res.json({
            success: true,
            count: users.length,
            subgroupCount: subgroups.length,
            users: users.map(u => ({
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                dn: u.dn,
                isDisabled: u.isDisabled,
                groups: userGroupMap.get(u.username) || []
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

        const allLdapGroups = await ldap.getGroups();

        // Get parent group name from filter (extract from CN=...)
        const groupFilter = process.env.LDAP_GROUP_SEARCH_FILTER || '';
        const parentGroupMatch = groupFilter.match(/CN=([^,)]+)/);
        const parentGroupName = parentGroupMatch ? parentGroupMatch[1] : null;

        // Filter out parent group - only show subgroups
        const groups = allLdapGroups.filter(group => {
            const isParent = parentGroupName && group.name === parentGroupName;
            return !isParent;
        });

        await ldap.disconnect();

        // Log audit
        if (req.user) {
            await req.app.locals.db.logAction(
                req.user.id,
                req.user.username,
                'ldap_preview_groups',
                'ldap',
                null,
                `Anteprima ${groups.length} sottogruppi LDAP (escluso gruppo padre: ${parentGroupName || 'nessuno'})`,
                req.ip,
                req.get('user-agent')
            );
        }

        res.json({
            success: true,
            count: groups.length,
            parentGroup: parentGroupName,
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
        if (req.user && result.success) {
            const details = `Sync LDAP ${dryRun ? '(simulazione)' : 'completato'}: ${result.stats.usersAdded} utenti aggiunti, ${result.stats.usersUpdated} aggiornati, ${result.stats.usersRemoved || 0} rimossi, ${result.stats.groupsAdded} gruppi aggiunti, ${result.stats.groupsUpdated} aggiornati, ${result.stats.groupsRemoved || 0} rimossi`;
            await req.app.locals.db.logAction(
                req.user.id,
                req.user.username,
                dryRun ? 'ldap_sync_dryrun' : 'ldap_sync',
                'ldap',
                null,
                details,
                req.ip,
                req.get('user-agent')
            );
        }

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
        const ldapUsersResult = await req.app.locals.db.query('SELECT COUNT(*) as count FROM users WHERE is_ldap_user = TRUE');
        const ldapGroupsResult = await req.app.locals.db.query('SELECT COUNT(*) as count FROM groups WHERE is_ldap_group = TRUE');
        const totalUsersResult = await req.app.locals.db.query('SELECT COUNT(*) as count FROM users');
        const totalGroupsResult = await req.app.locals.db.query('SELECT COUNT(*) as count FROM groups');

        // Get last sync info
        const lastSync = await req.app.locals.db.query('SELECT * FROM ldap_sync_logs ORDER BY started_at DESC LIMIT 1');

        res.json({
            success: true,
            ldapUsers: ldapUsersResult[0]?.count || 0,
            ldapGroups: ldapGroupsResult[0]?.count || 0,
            totalUsers: totalUsersResult[0]?.count || 0,
            totalGroups: totalGroupsResult[0]?.count || 0,
            lastSync: lastSync[0] || null
        });
    } catch (error) {
        console.error('LDAP stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
