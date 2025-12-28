/**
 * Database migration to add LDAP support
 * Adds LDAP-related columns to users and groups tables
 * Creates ldap_sync_logs table
 * 
 * Usage: node migrate-ldap.js
 */

import 'dotenv/config';
import Database from './server/database-new.js';

console.log('🔄 Running LDAP migration...\n');

const db = new Database();

async function migrate() {
    try {
        // Wait a bit for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Database connected\n');

        // Add LDAP columns to users table
        console.log('📝 Adding LDAP columns to users table...');
        try {
            if (db.dbType === 'postgres') {
                await db.query(`
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS ldap_dn TEXT,
                    ADD COLUMN IF NOT EXISTS ldap_guid TEXT UNIQUE,
                    ADD COLUMN IF NOT EXISTS is_ldap_user BOOLEAN DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS ldap_synced_at TIMESTAMP
                `);
            } else {
                // SQLite requires separate ALTER TABLE statements
                // Note: SQLite doesn't support adding UNIQUE columns via ALTER TABLE
                const columns = [
                    'ALTER TABLE users ADD COLUMN ldap_dn TEXT',
                    'ALTER TABLE users ADD COLUMN ldap_guid TEXT',
                    'ALTER TABLE users ADD COLUMN is_ldap_user INTEGER DEFAULT 0',
                    'ALTER TABLE users ADD COLUMN ldap_synced_at DATETIME'
                ];
                
                for (const sql of columns) {
                    try {
                        await db.query(sql);
                    } catch (err) {
                        if (!err.message.includes('duplicate column')) {
                            throw err;
                        }
                    }
                }
                
                // Create index for ldap_guid uniqueness
                try {
                    await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ldap_guid ON users(ldap_guid) WHERE ldap_guid IS NOT NULL');
                } catch (err) {
                    if (!err.message.includes('already exists')) {
                        console.log('   ℹ️  Note: Could not create unique index on ldap_guid');
                    }
                }
            }
            console.log('✅ Users table updated');
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
                console.log('ℹ️  LDAP columns already exist in users table');
            } else {
                throw err;
            }
        }

        // Add LDAP columns to groups table
        console.log('📝 Adding LDAP columns to groups table...');
        try {
            if (db.dbType === 'postgres') {
                await db.query(`
                    ALTER TABLE groups 
                    ADD COLUMN IF NOT EXISTS ldap_dn TEXT,
                    ADD COLUMN IF NOT EXISTS ldap_guid TEXT UNIQUE,
                    ADD COLUMN IF NOT EXISTS is_ldap_group BOOLEAN DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS ldap_synced_at TIMESTAMP
                `);
            } else {
                // SQLite requires separate ALTER TABLE statements
                // Note: SQLite doesn't support adding UNIQUE columns via ALTER TABLE
                const columns = [
                    'ALTER TABLE groups ADD COLUMN ldap_dn TEXT',
                    'ALTER TABLE groups ADD COLUMN ldap_guid TEXT',
                    'ALTER TABLE groups ADD COLUMN is_ldap_group INTEGER DEFAULT 0',
                    'ALTER TABLE groups ADD COLUMN ldap_synced_at DATETIME'
                ];
                
                for (const sql of columns) {
                    try {
                        await db.query(sql);
                    } catch (err) {
                        if (!err.message.includes('duplicate column')) {
                            throw err;
                        }
                    }
                }
                
                // Create index for ldap_guid uniqueness
                try {
                    await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_ldap_guid ON groups(ldap_guid) WHERE ldap_guid IS NOT NULL');
                } catch (err) {
                    if (!err.message.includes('already exists')) {
                        console.log('   ℹ️  Note: Could not create unique index on ldap_guid');
                    }
                }
            }
            console.log('✅ Groups table updated');
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
                console.log('ℹ️  LDAP columns already exist in groups table');
            } else {
                throw err;
            }
        }

        // Create ldap_sync_logs table
        console.log('📝 Creating ldap_sync_logs table...');
        if (db.dbType === 'postgres') {
            await db.query(`
                CREATE TABLE IF NOT EXISTS ldap_sync_logs (
                    id SERIAL PRIMARY KEY,
                    sync_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    users_added INTEGER DEFAULT 0,
                    users_updated INTEGER DEFAULT 0,
                    users_disabled INTEGER DEFAULT 0,
                    groups_added INTEGER DEFAULT 0,
                    groups_updated INTEGER DEFAULT 0,
                    errors TEXT,
                    started_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP,
                    started_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                )
            `);
        } else {
            await db.query(`
                CREATE TABLE IF NOT EXISTS ldap_sync_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sync_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    users_added INTEGER DEFAULT 0,
                    users_updated INTEGER DEFAULT 0,
                    users_disabled INTEGER DEFAULT 0,
                    groups_added INTEGER DEFAULT 0,
                    groups_updated INTEGER DEFAULT 0,
                    errors TEXT,
                    started_at DATETIME NOT NULL,
                    completed_at DATETIME,
                    started_by_user_id INTEGER,
                    FOREIGN KEY (started_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `);
        }
        console.log('✅ ldap_sync_logs table created');

        console.log('\n✨ LDAP migration completed successfully!\n');
        console.log('📋 Changes made:');
        console.log('   - Added ldap_dn, ldap_guid, is_ldap_user, ldap_synced_at to users');
        console.log('   - Added ldap_dn, ldap_guid, is_ldap_group, ldap_synced_at to groups');
        console.log('   - Created ldap_sync_logs table\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

migrate();
