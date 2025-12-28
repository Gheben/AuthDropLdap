/**
 * Migration: Add is_group_admin and joined_at columns to group_members table
 */

import Database from './server/database-new.js';
import 'dotenv/config';

async function migrate() {
    console.log('🔄 Starting migration: Add is_group_admin to group_members...\n');

    const db = new Database();

    try {
        if (db.dbType === 'sqlite') {
            console.log('📁 SQLite database detected');

            // Check if column already exists
            const tableInfo = await new Promise((resolve, reject) => {
                db.db.all('PRAGMA table_info(group_members)', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            const hasIsGroupAdmin = tableInfo.some(col => col.name === 'is_group_admin');
            const hasJoinedAt = tableInfo.some(col => col.name === 'joined_at');

            if (!hasIsGroupAdmin) {
                console.log('➕ Adding is_group_admin column...');
                await db.query('ALTER TABLE group_members ADD COLUMN is_group_admin BOOLEAN DEFAULT 0');
                console.log('✅ is_group_admin column added');
            } else {
                console.log('✅ is_group_admin column already exists');
            }

            if (!hasJoinedAt) {
                console.log('➕ Adding joined_at column...');
                await db.query('ALTER TABLE group_members ADD COLUMN joined_at DATETIME DEFAULT CURRENT_TIMESTAMP');
                console.log('✅ joined_at column added');
            } else {
                console.log('✅ joined_at column already exists');
            }

        } else {
            console.log('🐘 PostgreSQL database detected');

            // Check if columns exist
            const result = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'group_members' 
                AND column_name IN ('is_group_admin', 'joined_at')
            `);

            const existingColumns = result.map(row => row.column_name);

            if (!existingColumns.includes('is_group_admin')) {
                console.log('➕ Adding is_group_admin column...');
                await db.query('ALTER TABLE group_members ADD COLUMN is_group_admin BOOLEAN DEFAULT FALSE');
                console.log('✅ is_group_admin column added');
            } else {
                console.log('✅ is_group_admin column already exists');
            }

            if (!existingColumns.includes('joined_at')) {
                console.log('➕ Adding joined_at column...');
                await db.query('ALTER TABLE group_members ADD COLUMN joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
                console.log('✅ joined_at column added');
            } else {
                console.log('✅ joined_at column already exists');
            }
        }

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

migrate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
