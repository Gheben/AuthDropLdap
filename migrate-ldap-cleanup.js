/**
 * Database migration to add cleanup statistics to ldap_sync_logs
 * Adds users_removed and groups_removed columns
 * 
 * Usage: node migrate-ldap-cleanup.js
 */

import 'dotenv/config';
import Database from './server/database-new.js';

console.log('🔄 Running LDAP cleanup migration...\n');

const db = new Database();

async function migrate() {
    try {
        // Wait a bit for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Database connected\n');

        // Add cleanup columns to ldap_sync_logs table
        console.log('📝 Adding cleanup columns to ldap_sync_logs table...');
        try {
            if (db.dbType === 'postgres') {
                await db.query(`
                    ALTER TABLE ldap_sync_logs 
                    ADD COLUMN IF NOT EXISTS users_removed INTEGER DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS groups_removed INTEGER DEFAULT 0
                `);
            } else {
                // SQLite requires separate ALTER TABLE statements
                const columns = [
                    'ALTER TABLE ldap_sync_logs ADD COLUMN users_removed INTEGER DEFAULT 0',
                    'ALTER TABLE ldap_sync_logs ADD COLUMN groups_removed INTEGER DEFAULT 0'
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
            }
            console.log('✅ Cleanup columns added to ldap_sync_logs table');
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
                console.log('ℹ️  Cleanup columns already exist in ldap_sync_logs table');
            } else {
                throw err;
            }
        }

        console.log('\n✨ LDAP cleanup migration completed successfully!\n');
        console.log('📋 Changes made:');
        console.log('   - Added users_removed, groups_removed to ldap_sync_logs\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

migrate();
