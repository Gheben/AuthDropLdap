/**
 * LDAP/Active Directory Connector
 * Handles connection and queries to LDAP/AD servers
 * Supports both LDAP (port 389) and LDAPS (port 636)
 */

import { Client } from 'ldapts';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tls = require('tls');

class LDAPConnector {
    constructor(config) {
        this.config = {
            url: config.url || process.env.LDAP_URL,
            bindDN: config.bindDN || process.env.LDAP_BIND_DN,
            bindPassword: config.bindPassword || process.env.LDAP_BIND_PASSWORD,
            baseDN: config.baseDN || process.env.LDAP_BASE_DN,
            userSearchBase: config.userSearchBase || process.env.LDAP_USER_SEARCH_BASE,
            groupSearchBase: config.groupSearchBase || process.env.LDAP_GROUP_SEARCH_BASE,
            userSearchFilter: config.userSearchFilter || process.env.LDAP_USER_SEARCH_FILTER || '(objectClass=user)',
            groupSearchFilter: config.groupSearchFilter || process.env.LDAP_GROUP_SEARCH_FILTER || '(objectClass=group)',
            tlsOptions: {
                rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false'
            }
        };
        
        // Debug TLS configuration
        console.log('🔐 LDAP TLS Configuration:', {
            rejectUnauthorized: this.config.tlsOptions.rejectUnauthorized,
            envValue: process.env.LDAP_TLS_REJECT_UNAUTHORIZED
        });
        
        this.client = null;
    }

    /**
     * Test LDAP connection
     */
    async testConnection() {
        try {
            await this.connect();
            await this.disconnect();
            return { 
                success: true, 
                message: 'Connection successful',
                serverInfo: this.config.url
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Connect to LDAP server
     */
    async connect() {
        try {
            const clientOptions = {
                url: this.config.url,
                timeout: 10000,
                connectTimeout: 10000
            };

            // Add TLS options for LDAPS
            if (this.config.url.startsWith('ldaps://')) {
                clientOptions.tlsOptions = this.config.tlsOptions;
            }

            this.client = new Client(clientOptions);

            // Bind with service account
            await this.client.bind(this.config.bindDN, this.config.bindPassword);
            
            console.log(`✅ Connected to LDAP: ${this.config.url}`);
        } catch (error) {
            console.error('❌ LDAP connection failed:', error.message);
            throw new Error(`LDAP connection failed: ${error.message}`);
        }
    }

    /**
     * Disconnect from LDAP server
     */
    async disconnect() {
        if (this.client) {
            try {
                await this.client.unbind();
                this.client = null;
            } catch (error) {
                console.error('Error disconnecting from LDAP:', error);
            }
        }
    }

    /**
     * Search LDAP
     */
    async search(base, options) {
        if (!this.client) {
            await this.connect();
        }

        try {
            const searchOptions = {
                scope: 'sub',
                ...options
            };

            const { searchEntries } = await this.client.search(base, searchOptions);
            return searchEntries;
        } catch (error) {
            console.error('LDAP search error:', error);
            throw error;
        }
    }

    /**
     * Get all users from LDAP
     */
    async getUsers(filter = null) {
        const searchFilter = filter || this.config.userSearchFilter;
        const searchBase = this.config.userSearchBase || this.config.baseDN;
        
        try {
            const results = await this.search(searchBase, {
                filter: searchFilter,
                attributes: [
                    'distinguishedName',
                    'objectGUID',
                    'sAMAccountName',
                    'userPrincipalName',
                    'displayName',
                    'givenName',
                    'sn',
                    'mail',
                    'memberOf',
                    'userAccountControl'
                ]
            });

            return results.map(entry => this.parseUser(entry));
        } catch (error) {
            console.error('Error fetching users from LDAP:', error);
            throw error;
        }
    }

    /**
     * Get single user by username
     */
    async getUserByUsername(username) {
        const userIdAttr = process.env.LDAP_USER_ID_ATTRIBUTE || 'sAMAccountName';
        const filter = `(&${this.config.userSearchFilter}(${userIdAttr}=${username}))`;
        
        const users = await this.getUsers(filter);
        return users.length > 0 ? users[0] : null;
    }

    /**
     * Get single user by Distinguished Name (DN)
     */
    async getUserByDN(dn) {
        try {
            const result = await this.search(dn, {
                scope: 'base',
                attributes: [
                    'distinguishedName',
                    'objectGUID',
                    'sAMAccountName',
                    'userPrincipalName',
                    'displayName',
                    'givenName',
                    'sn',
                    'mail',
                    'memberOf',
                    'userAccountControl'
                ]
            });

            if (result && result.length > 0) {
                return this.parseUser(result[0]);
            }
            return null;
        } catch (error) {
            console.error(`Error fetching user by DN (${dn}):`, error.message);
            return null;
        }
    }

    /**
     * Authenticate user against LDAP
     */
    async authenticateUser(username, password) {
        try {
            // Get user DN
            const user = await this.getUserByUsername(username);
            if (!user) {
                return { success: false, message: 'User not found in LDAP' };
            }

            // Check if account is disabled
            if (user.isDisabled) {
                return { success: false, message: 'Account is disabled' };
            }

            // Try to bind with user credentials
            const userClient = new Client({
                url: this.config.url,
                timeout: 10000,
                connectTimeout: 10000,
                tlsOptions: this.config.url.startsWith('ldaps://') ? this.config.tlsOptions : undefined
            });

            try {
                await userClient.bind(user.dn, password);
                await userClient.unbind();
                return { success: true, user };
            } catch (bindError) {
                return { success: false, message: 'Invalid credentials' };
            }
        } catch (error) {
            console.error('LDAP authentication error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get all groups from LDAP
     */
    async getGroups(filter = null) {
        const searchFilter = filter || this.config.groupSearchFilter;
        const searchBase = this.config.groupSearchBase || this.config.baseDN;
        
        try {
            const results = await this.search(searchBase, {
                filter: searchFilter,
                attributes: [
                    'distinguishedName',
                    'objectGUID',
                    'cn',
                    'name',
                    'description',
                    'member',
                    'memberOf'
                ]
            });

            return results.map(entry => this.parseGroup(entry));
        } catch (error) {
            console.error('Error fetching groups from LDAP:', error);
            throw error;
        }
    }

    /**
     * Get members of a group
     */
    async getGroupMembers(groupDN) {
        try {
            const results = await this.search(this.config.baseDN, {
                filter: `(memberOf=${groupDN})`,
                attributes: ['distinguishedName', 'objectGUID', 'sAMAccountName', 'displayName', 'mail']
            });

            return results;
        } catch (error) {
            console.error('Error fetching group members:', error);
            throw error;
        }
    }

    /**
     * Parse LDAP user entry
     */
    parseUser(entry) {
        // Handle objectGUID (binary to string)
        let guid = null;
        if (entry.objectGUID) {
            const buffer = Buffer.from(entry.objectGUID, 'binary');
            guid = this.bufferToGUID(buffer);
        }

        // Check if user is disabled (userAccountControl flag)
        const isDisabled = entry.userAccountControl 
            ? (parseInt(entry.userAccountControl) & 0x0002) !== 0 
            : false;

        // Normalize username to lowercase for case-insensitive comparison
        const rawUsername = entry.sAMAccountName || entry.uid;
        const username = rawUsername ? rawUsername.toLowerCase() : null;

        return {
            dn: entry.distinguishedName || entry.dn,
            guid: guid,
            username: username,
            email: entry.mail,
            displayName: entry.displayName || entry.cn,
            firstName: entry.givenName,
            lastName: entry.sn,
            memberOf: Array.isArray(entry.memberOf) ? entry.memberOf : (entry.memberOf ? [entry.memberOf] : []),
            isDisabled: isDisabled
        };
    }

    /**
     * Parse LDAP group entry
     */
    parseGroup(entry) {
        // Handle objectGUID (binary to string)
        let guid = null;
        if (entry.objectGUID) {
            const buffer = Buffer.from(entry.objectGUID, 'binary');
            guid = this.bufferToGUID(buffer);
        }

        return {
            dn: entry.distinguishedName || entry.dn,
            guid: guid,
            name: entry.cn || entry.name,
            description: entry.description,
            members: Array.isArray(entry.member) ? entry.member : (entry.member ? [entry.member] : []),
            memberOf: Array.isArray(entry.memberOf) ? entry.memberOf : (entry.memberOf ? [entry.memberOf] : [])
        };
    }

    /**
     * Convert binary GUID buffer to string
     */
    bufferToGUID(buffer) {
        const hex = buffer.toString('hex');
        return [
            hex.substring(6, 8) + hex.substring(4, 6) + hex.substring(2, 4) + hex.substring(0, 2),
            hex.substring(10, 12) + hex.substring(8, 10),
            hex.substring(14, 16) + hex.substring(12, 14),
            hex.substring(16, 20),
            hex.substring(20, 32)
        ].join('-');
    }
}

export default LDAPConnector;
