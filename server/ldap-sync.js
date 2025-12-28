/**
 * LDAP Synchronization Module
 * Handles import and sync of users and groups from LDAP/AD to local database
 */

import LDAPConnector from './ldap-connector.js';
import bcrypt from 'bcrypt';

class LDAPSync {
    constructor(database, ldapConnector = null) {
        this.db = database;
        this.ldap = ldapConnector;
        this.stats = {
            usersAdded: 0,
            usersUpdated: 0,
            usersDisabled: 0,
            groupsAdded: 0,
            groupsUpdated: 0,
            errors: []
        };
    }

    /**
     * Initialize LDAP connector if not provided
     */
    async initConnector() {
        if (!this.ldap) {
            this.ldap = new LDAPConnector({});
        }
        await this.ldap.connect();
    }

    /**
     * Full synchronization of users and groups
     */
    async fullSync(initiatedByUserId = null, dryRun = false) {
        const startTime = new Date();
        let syncLogId = null;

        try {
            console.log(`\n🔄 Starting LDAP ${dryRun ? 'DRY RUN' : 'SYNC'}...`);
            
            await this.initConnector();

            // Create sync log entry
            if (!dryRun) {
                syncLogId = await this.createSyncLog('full', 'running', initiatedByUserId, startTime);
            }

            // Reset stats
            this.resetStats();

            // Sync groups first (to have group IDs for user membership)
            await this.syncGroups(dryRun);

            // Then sync users
            await this.syncUsers(dryRun);

            // Update sync log
            if (!dryRun && syncLogId) {
                await this.updateSyncLog(syncLogId, 'success', new Date());
            }

            console.log('✅ LDAP sync completed successfully');
            return { success: true, stats: this.stats, dryRun };

        } catch (error) {
            console.error('❌ LDAP sync failed:', error);
            this.stats.errors.push(error.message);

            if (!dryRun && syncLogId) {
                await this.updateSyncLog(syncLogId, 'error', new Date());
            }

            return { success: false, error: error.message, stats: this.stats, dryRun };
        } finally {
            if (this.ldap) {
                await this.ldap.disconnect();
            }
        }
    }

    /**
     * Sync groups from LDAP
     */
    async syncGroups(dryRun = false) {
        console.log('\n📁 Syncing groups from LDAP...');

        try {
            const ldapGroups = await this.ldap.getGroups();
            console.log(`   Found ${ldapGroups.length} groups in LDAP`);

            for (const ldapGroup of ldapGroups) {
                try {
                    await this.syncGroup(ldapGroup, dryRun);
                } catch (error) {
                    console.error(`   ❌ Error syncing group ${ldapGroup.name}:`, error.message);
                    this.stats.errors.push(`Group ${ldapGroup.name}: ${error.message}`);
                }
            }

            console.log(`   ✅ Groups synced: ${this.stats.groupsAdded} added, ${this.stats.groupsUpdated} updated`);
        } catch (error) {
            console.error('Error in syncGroups:', error);
            throw error;
        }
    }

    /**
     * Sync single group
     */
    async syncGroup(ldapGroup, dryRun = false) {
        // Check if group exists by GUID
        let existingGroup = null;
        if (ldapGroup.guid) {
            const rows = await this.db.query('SELECT * FROM groups WHERE ldap_guid = ?', [ldapGroup.guid]);
            existingGroup = rows && rows[0] ? rows[0] : null;
        }

        // If not found by GUID, try by name
        if (!existingGroup) {
            const rows = await this.db.query('SELECT * FROM groups WHERE name = ? AND is_ldap_group = TRUE', [ldapGroup.name]);
            existingGroup = rows && rows[0] ? rows[0] : null;
        }

        if (existingGroup) {
            // Update existing group
            if (!dryRun) {
                await this.db.query(
                    `UPDATE groups 
                     SET name = ?, description = ?, ldap_dn = ?, ldap_guid = ?, ldap_synced_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [ldapGroup.name, ldapGroup.description, ldapGroup.dn, ldapGroup.guid, existingGroup.id]
                );
            }
            this.stats.groupsUpdated++;
            console.log(`   🔄 Updated group: ${ldapGroup.name}`);
        } else {
            // Create new group
            if (!dryRun) {
                await this.db.query(
                    `INSERT INTO groups (name, description, ldap_dn, ldap_guid, is_ldap_group, ldap_synced_at)
                     VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
                    [ldapGroup.name, ldapGroup.description, ldapGroup.dn, ldapGroup.guid]
                );
            }
            this.stats.groupsAdded++;
            console.log(`   ➕ Created group: ${ldapGroup.name}`);
        }
    }

    /**
     * Sync users from LDAP
     */
    async syncUsers(dryRun = false) {
        console.log('\n👥 Syncing users from LDAP...');

        try {
            const ldapUsers = await this.ldap.getUsers();
            console.log(`   Found ${ldapUsers.length} users in LDAP`);

            for (const ldapUser of ldapUsers) {
                try {
                    await this.syncUser(ldapUser, dryRun);
                } catch (error) {
                    console.error(`   ❌ Error syncing user ${ldapUser.username}:`, error.message);
                    this.stats.errors.push(`User ${ldapUser.username}: ${error.message}`);
                }
            }

            console.log(`   ✅ Users synced: ${this.stats.usersAdded} added, ${this.stats.usersUpdated} updated, ${this.stats.usersDisabled} disabled`);
        } catch (error) {
            console.error('Error in syncUsers:', error);
            throw error;
        }
    }

    /**
     * Sync single user
     */
    async syncUser(ldapUser, dryRun = false) {
        // Check if user exists by GUID
        let existingUser = null;
        if (ldapUser.guid) {
            const rows = await this.db.query('SELECT * FROM users WHERE ldap_guid = ?', [ldapUser.guid]);
            existingUser = rows && rows[0] ? rows[0] : null;
        }

        // If not found by GUID, try by username
        if (!existingUser) {
            const rows = await this.db.query('SELECT * FROM users WHERE username = ? AND is_ldap_user = TRUE', [ldapUser.username]);
            existingUser = rows && rows[0] ? rows[0] : null;
        }

        if (existingUser) {
            // Update existing user
            if (!dryRun) {
                await this.db.query(
                    `UPDATE users 
                     SET display_name = ?, email = ?, ldap_dn = ?, ldap_guid = ?, is_active = ?, ldap_synced_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [ldapUser.displayName, ldapUser.email, ldapUser.dn, ldapUser.guid, !ldapUser.isDisabled, existingUser.id]
                );

                // Sync group memberships
                await this.syncUserGroups(existingUser.id, ldapUser.memberOf, dryRun);
            }

            if (ldapUser.isDisabled && existingUser.is_active) {
                this.stats.usersDisabled++;
                console.log(`   ⏸️  Disabled user: ${ldapUser.username}`);
            } else {
                this.stats.usersUpdated++;
                console.log(`   🔄 Updated user: ${ldapUser.username}`);
            }
        } else {
            // Create new user
            // Generate random password (won't be used since LDAP auth will be used)
            const randomPassword = Math.random().toString(36).slice(-16);
            const passwordHash = await bcrypt.hash(randomPassword, 10);

            if (!dryRun) {
                const result = await this.db.query(
                    `INSERT INTO users (username, password_hash, display_name, email, ldap_dn, ldap_guid, is_ldap_user, is_active, ldap_synced_at)
                     VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP)`,
                    [ldapUser.username, passwordHash, ldapUser.displayName, ldapUser.email, ldapUser.dn, ldapUser.guid, !ldapUser.isDisabled]
                );

                // Get the new user ID
                let userId;
                if (this.db.dbType === 'postgres') {
                    const rows = await this.db.query('SELECT id FROM users WHERE username = ?', [ldapUser.username]);
                    userId = rows && rows[0] ? rows[0].id : null;
                } else {
                    userId = result.lastID;
                }

                if (userId) {
                    // Sync group memberships
                    await this.syncUserGroups(userId, ldapUser.memberOf, dryRun);
                }
            }

            this.stats.usersAdded++;
            console.log(`   ➕ Created user: ${ldapUser.username}`);
        }
    }

    /**
     * Sync user group memberships
     */
    async syncUserGroups(userId, memberOfDNs, dryRun = false) {
        if (!memberOfDNs || memberOfDNs.length === 0) return;

        for (const groupDN of memberOfDNs) {
            // Find group by DN
            const rows = await this.db.query('SELECT id FROM groups WHERE ldap_dn = ?', [groupDN]);
            if (rows && rows[0]) {
                const groupId = rows[0].id;

                // Add user to group if not already a member
                if (!dryRun) {
                    if (this.db.dbType === 'postgres') {
                        await this.db.query(
                            'INSERT INTO group_members (user_id, group_id) VALUES (?, ?) ON CONFLICT (group_id, user_id) DO NOTHING',
                            [userId, groupId]
                        );
                    } else {
                        await this.db.query(
                            'INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)',
                            [userId, groupId]
                        );
                    }
                }
            }
        }
    }

    /**
     * Create sync log entry
     */
    async createSyncLog(syncType, status, userId, startTime) {
        const result = await this.db.query(
            `INSERT INTO ldap_sync_logs (sync_type, status, started_at, started_by_user_id)
             VALUES (?, ?, ?, ?)`,
            [syncType, status, startTime, userId]
        );

        if (this.db.dbType === 'postgres') {
            const rows = await this.db.query('SELECT id FROM ldap_sync_logs ORDER BY id DESC LIMIT 1');
            return rows && rows[0] ? rows[0].id : null;
        } else {
            return result.lastID;
        }
    }

    /**
     * Update sync log entry
     */
    async updateSyncLog(logId, status, endTime) {
        await this.db.query(
            `UPDATE ldap_sync_logs 
             SET status = ?, completed_at = ?, 
                 users_added = ?, users_updated = ?, users_disabled = ?,
                 groups_added = ?, groups_updated = ?,
                 errors = ?
             WHERE id = ?`,
            [
                status,
                endTime,
                this.stats.usersAdded,
                this.stats.usersUpdated,
                this.stats.usersDisabled,
                this.stats.groupsAdded,
                this.stats.groupsUpdated,
                this.stats.errors.length > 0 ? this.stats.errors.join('\n') : null,
                logId
            ]
        );
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            usersAdded: 0,
            usersUpdated: 0,
            usersDisabled: 0,
            groupsAdded: 0,
            groupsUpdated: 0,
            errors: []
        };
    }

    /**
     * Get sync history
     */
    async getSyncHistory(limit = 20) {
        const rows = await this.db.query(
            `SELECT * FROM ldap_sync_logs ORDER BY started_at DESC LIMIT ?`,
            [limit]
        );
        return rows || [];
    }
}

export default LDAPSync;
