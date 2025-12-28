/**
 * Script to reset PostgreSQL database to clean state
 * - Drops all tables
 * - Recreates schema
 * - Creates only the super admin user from .env
 * 
 * WARNING: This will DELETE ALL DATA in the database!
 * 
 * Usage: node reset-postgres.js
 */

import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'authdrop'
});

console.log('🗑️  RESETTING PostgreSQL database to clean state...\n');
console.log('⚠️  WARNING: This will DELETE ALL DATA!\n');

async function resetDatabase() {
    try {
        // Drop all tables
        console.log('🔥 Dropping all existing tables...');
        await pool.query('DROP TABLE IF EXISTS audit_logs CASCADE');
        await pool.query('DROP TABLE IF EXISTS user_rooms CASCADE');
        await pool.query('DROP TABLE IF EXISTS paired_devices CASCADE');
        await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
        await pool.query('DROP TABLE IF EXISTS group_members CASCADE');
        await pool.query('DROP TABLE IF EXISTS groups CASCADE');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        console.log('✅ All tables dropped');

        // Recreate schema
        console.log('\n📝 Creating clean database schema...');

        // Users table
        await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                email TEXT,
                is_admin BOOLEAN DEFAULT FALSE,
                is_super_admin BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Groups table
        await pool.query(`
            CREATE TABLE groups (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                parent_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Group members table
        await pool.query(`
            CREATE TABLE group_members (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                is_group_admin BOOLEAN DEFAULT FALSE,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, user_id)
            )
        `);

        // Sessions table
        await pool.query(`
            CREATE TABLE sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Paired devices table
        await pool.query(`
            CREATE TABLE paired_devices (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                device_name TEXT,
                device_type TEXT,
                pair_key TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User rooms table
        await pool.query(`
            CREATE TABLE user_rooms (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                room_secret TEXT NOT NULL,
                room_name TEXT,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, room_secret)
            )
        `);

        // Audit logs table
        await pool.query(`
            CREATE TABLE audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                username TEXT,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id INTEGER,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database schema created');

        // Create super admin
        const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';

        console.log('\n👤 Creating super admin user...');
        const hash = await bcrypt.hash(adminPassword, 10);

        await pool.query(
            `INSERT INTO users (username, password_hash, display_name, is_admin, is_super_admin, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminUsername, hash, 'Super Administrator', true, true, true]
        );

        console.log('✅ Created super admin user:');
        console.log(`   Username: ${adminUsername}`);
        console.log(`   Password: ${adminPassword}`);
        console.log('\n✨ Database reset complete!');
        console.log('🔒 IMPORTANT: Change the super admin password immediately after first login!\n');

    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

resetDatabase();
