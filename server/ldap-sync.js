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
            usersRemoved: 0,
            groupsAdded: 0,
            groupsUpdated: 0,
            groupsRemoved: 0,
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
            const syncedGroupGuids = await this.syncGroups(dryRun);

            // Then sync users
            const syncedUserGuids = await this.syncUsers(dryRun);

            // Clean up orphaned LDAP users/groups that no longer exist in AD
            await this.cleanupOrphans(syncedGroupGuids, syncedUserGuids, dryRun);

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
     * Sync groups from LDAP - exclude parent group, only sync subgroups
     * @returns {Array} Array of GUIDs of synced groups
     */
    async syncGroups(dryRun = false) {
        console.log('\n📁 Syncing groups from LDAP (excluding parent group)...');

        const syncedGuids = [];

        try {
            const allLdapGroups = await this.ldap.getGroups();
            console.log(`   Found ${allLdapGroups.length} total groups in LDAP`);

            // Get parent group name from filter (extract from CN=...)
            const groupFilter = process.env.LDAP_GROUP_SEARCH_FILTER || '';
            const parentGroupMatch = groupFilter.match(/CN=([^,)]+)/);
            const parentGroupName = parentGroupMatch ? parentGroupMatch[1] : null;

            // Filter out parent group - only sync subgroups
            const ldapGroups = allLdapGroups.filter(group => {
                const isParent = parentGroupName && group.name === parentGroupName;
                if (isParent) {
                    console.log(`   ⚠️  Skipping parent group: ${group.name}`);
                    return false;
                }
                return true;
            });

            console.log(`   Processing ${ldapGroups.length} subgroups...`);

            for (const ldapGroup of ldapGroups) {
                try {
                    await this.syncGroup(ldapGroup, dryRun);
                    if (ldapGroup.guid) {
                        syncedGuids.push(ldapGroup.guid);
                    }
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

        return syncedGuids;
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
     * Sync users from LDAP - only users who are members of subgroups (not parent group)
     * @returns {Array} Array of GUIDs of synced users
     */
    async syncUsers(dryRun = false) {
        console.log('\n👥 Syncing users from LDAP (only subgroup members)...');

        const syncedGuids = [];

        try {
            // Get all groups from LDAP
            const allLdapGroups = await this.ldap.getGroups();
            
            // Get parent group name from filter
            const groupFilter = process.env.LDAP_GROUP_SEARCH_FILTER || '';
            const parentGroupMatch = groupFilter.match(/CN=([^,)]+)/);
            const parentGroupName = parentGroupMatch ? parentGroupMatch[1] : null;

            // Filter to get only subgroups (exclude parent)
            const subgroups = allLdapGroups.filter(g => !parentGroupName || g.name !== parentGroupName);
            console.log(`   Found ${subgroups.length} subgroups in LDAP`);

            // Map to track user -> groups mapping for later assignment
            const userGroupsMap = new Map(); // username -> [groupIds or group names for dry-run]
            const uniqueUsers = new Map(); // username -> user object

            for (const ldapGroup of subgroups) {
                // Get group ID from database (or use group name for dry-run)
                let groupIdentifier = null;
                
                if (!dryRun) {
                    const dbGroupRows = await this.db.query(
                        'SELECT id FROM groups WHERE ldap_dn = ? OR (name = ? AND is_ldap_group = TRUE)',
                        [ldapGroup.dn, ldapGroup.name]
                    );
                    const dbGroup = dbGroupRows && dbGroupRows[0] ? dbGroupRows[0] : null;
                    
                    if (!dbGroup) {
                        console.log(`   ⚠️  Group "${ldapGroup.name}" not found in database, skipping users`);
                        continue;
                    }
                    groupIdentifier = dbGroup.id;
                } else {
                    // In dry-run, use group name as identifier
                    groupIdentifier = ldapGroup.name;
                }

                if (ldapGroup.members && ldapGroup.members.length > 0) {
                    console.log(`   📋 Subgroup "${ldapGroup.name}" has ${ldapGroup.members.length} members`);
                    
                    // Get user details for each member DN
                    for (const memberDN of ldapGroup.members) {
                        try {
                            const user = await this.ldap.getUserByDN(memberDN);
                            if (user) {
                                // Add user to unique collection
                                if (!uniqueUsers.has(user.username)) {
                                    uniqueUsers.set(user.username, user);
                                }
                                
                                // Track group membership
                                if (!userGroupsMap.has(user.username)) {
                                    userGroupsMap.set(user.username, []);
                                }
                                if (!userGroupsMap.get(user.username).includes(groupIdentifier)) {
                                    userGroupsMap.get(user.username).push(groupIdentifier);
                                }
                            }
                        } catch (error) {
                            console.error(`   ⚠️  Could not fetch member: ${memberDN}`, error.message);
                        }
                    }
                } else {
                    console.log(`   ⚠️  Subgroup "${ldapGroup.name}" is empty (no user members)`);
                }
            }

            const ldapUsers = Array.from(uniqueUsers.values());
            console.log(`   Found ${ldapUsers.length} unique users across all subgroups`);

            // Sync users and assign to groups
            for (const ldapUser of ldapUsers) {
                try {
                    const userId = await this.syncUser(ldapUser, dryRun);
                    
                    // Track synced GUID
                    if (ldapUser.guid) {
                        syncedGuids.push(ldapUser.guid);
                    }
                    
                    // Assign user to their groups
                    if (userGroupsMap.has(ldapUser.username)) {
                        const groups = userGroupsMap.get(ldapUser.username);
                        if (dryRun) {
                            console.log(`   👤 User "${ldapUser.username}" → Groups: [${groups.join(', ')}]`);
                        } else if (userId) {
                            await this.syncUserGroups(userId, groups, dryRun);
                        }
                    }
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

        return syncedGuids;
    }

    /**
     * Sync single user - returns userId
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
            }

            if (ldapUser.isDisabled && existingUser.is_active) {
                this.stats.usersDisabled++;
                console.log(`   ⏸️  Disabled user: ${ldapUser.username}`);
            } else {
                this.stats.usersUpdated++;
                console.log(`   🔄 Updated user: ${ldapUser.username}`);
            }
            
            return existingUser.id;
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

                this.stats.usersAdded++;
                console.log(`   ➕ Created user: ${ldapUser.username}`);
                
                return userId;
            } else {
                this.stats.usersAdded++;
                console.log(`   ➕ Created user: ${ldapUser.username}`);
                return null; // Dry run, no ID
            }
        }
    }

    /**
     * Sync user group memberships
     * @param {number} userId - User ID
     * @param {Array} groupIds - Array of group IDs or DNs (auto-detect)
     */
    async syncUserGroups(userId, groupIds, dryRun = false) {
        if (!groupIds || groupIds.length === 0) return;

        // Check if groupIds are numbers (IDs) or strings (DNs)
        const firstItem = groupIds[0];
        const isGroupIdArray = typeof firstItem === 'number';

        if (isGroupIdArray) {
            // Direct group IDs - just insert into group_members
            for (const groupId of groupIds) {
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
        } else {
            // DNs - lookup groups first
            for (const groupDN of groupIds) {
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
    }

    /**
     * Clean up orphaned LDAP users and groups that no longer exist in AD
     */
    async cleanupOrphans(syncedGroupGuids, syncedUserGuids, dryRun = false) {
        console.log('\n🧹 Cleaning up orphaned LDAP records...');

        try {
            // Clean up orphaned groups
            let orphanedGroupsCount = 0;
            if (syncedGroupGuids.length > 0) {
                const placeholders = syncedGroupGuids.map(() => '?').join(',');
                const orphanedGroups = await this.db.query(
                    `SELECT id, name FROM groups 
                     WHERE is_ldap_group = TRUE 
                     AND ldap_guid IS NOT NULL 
                     AND ldap_guid NOT IN (${placeholders})`,
                    syncedGroupGuids
                );

                if (orphanedGroups && orphanedGroups.length > 0) {
                    console.log(`   Found ${orphanedGroups.length} orphaned LDAP groups`);
                    
                    for (const group of orphanedGroups) {
                        if (!dryRun) {
                            // Delete group members first (referential integrity)
                            await this.db.query('DELETE FROM group_members WHERE group_id = ?', [group.id]);
                            
                            // Delete the group
                            await this.db.query('DELETE FROM groups WHERE id = ?', [group.id]);
                        }
                        console.log(`   🗑️  Removed orphaned group: ${group.name}`);
                        orphanedGroupsCount++;
                    }
                }
            }

            // Clean up orphaned users
            let orphanedUsersCount = 0;
            if (syncedUserGuids.length > 0) {
                const placeholders = syncedUserGuids.map(() => '?').join(',');
                const orphanedUsers = await this.db.query(
                    `SELECT id, username FROM users 
                     WHERE is_ldap_user = TRUE 
                     AND ldap_guid IS NOT NULL 
                     AND ldap_guid NOT IN (${placeholders})`,
                    syncedUserGuids
                );

                if (orphanedUsers && orphanedUsers.length > 0) {
                    console.log(`   Found ${orphanedUsers.length} orphaned LDAP users`);
                    
                    for (const user of orphanedUsers) {
                        if (!dryRun) {
                            // Delete user's group memberships first
                            await this.db.query('DELETE FROM group_members WHERE user_id = ?', [user.id]);
                            
                            // Delete the user
                            await this.db.query('DELETE FROM users WHERE id = ?', [user.id]);
                        }
                        console.log(`   🗑️  Removed orphaned user: ${user.username}`);
                        orphanedUsersCount++;
                    }
                }
            }

            // Update stats
            this.stats.groupsRemoved = orphanedGroupsCount;
            this.stats.usersRemoved = orphanedUsersCount;

            if (orphanedGroupsCount > 0 || orphanedUsersCount > 0) {
                console.log(`   ✅ Cleanup completed: ${orphanedUsersCount} users, ${orphanedGroupsCount} groups removed`);
            } else {
                console.log(`   ✅ No orphaned records found`);
            }

        } catch (error) {
            console.error('Error in cleanupOrphans:', error);
            this.stats.errors.push(`Cleanup error: ${error.message}`);
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
                 users_added = ?, users_updated = ?, users_disabled = ?, users_removed = ?,
                 groups_added = ?, groups_updated = ?, groups_removed = ?,
                 errors = ?
             WHERE id = ?`,
            [
                status,
                endTime,
                this.stats.usersAdded,
                this.stats.usersUpdated,
                this.stats.usersDisabled,
                this.stats.usersRemoved || 0,
                this.stats.groupsAdded,
                this.stats.groupsUpdated,
                this.stats.groupsRemoved || 0,
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
            usersRemoved: 0,
            groupsAdded: 0,
            groupsUpdated: 0,
            groupsRemoved: 0,
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
