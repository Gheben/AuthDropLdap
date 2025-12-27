/**
 * Database abstraction layer
 * Supporta sia SQLite (locale) che PostgreSQL (Docker)
 */

import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
        const dbType = process.env.DB_TYPE || 'sqlite';
        this.dbType = dbType;

        if (dbType === 'postgres') {
            console.log('🐘 Using PostgreSQL database');
            this.initPostgres();
        } else {
            console.log('📁 Using SQLite database');
            this.initSQLite();
        }
    }

    initPostgres() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'authdrop',
            user: process.env.DB_USER || 'authdrop',
            password: process.env.DB_PASSWORD || 'authdrop123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected PostgreSQL error:', err);
        });

        console.log(`Database connected: postgresql://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        this.initialize();
    }

    initSQLite() {
        const sqlite = sqlite3.verbose();
        const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'authdrop.db');
        
        this.db = new sqlite.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Database connected:', dbPath);
                this.initialize();
            }
        });
    }

    async query(sql, params = []) {
        if (this.dbType === 'postgres') {
            return this.queryPostgres(sql, params);
        } else {
            return this.querySQLite(sql, params);
        }
    }

    async queryPostgres(sql, params = []) {
        // Convert SQLite syntax to PostgreSQL
        let pgSql = sql
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
            .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
            .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE');

        // Convert ? placeholders to $1, $2, etc.
        let paramIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

        try {
            const result = await this.pool.query(pgSql, params);
            return result.rows;
        } catch (err) {
            console.error('PostgreSQL query error:', err);
            console.error('SQL:', pgSql);
            console.error('Params:', params);
            throw err;
        }
    }

    querySQLite(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                this.db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            } else {
                this.db.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            }
        });
    }

    async initialize() {
        try {
            if (this.dbType === 'postgres') {
                await this.initializePostgres();
            } else {
                await this.initializeSQLite();
            }
        } catch (err) {
            console.error('Database initialization error:', err);
        }
    }

    async initializePostgres() {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            // Users table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
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
            await client.query(`
                CREATE TABLE IF NOT EXISTS groups (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    parent_group_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE SET NULL
                )
            `);

            // Group members table
            await client.query(`
                CREATE TABLE IF NOT EXISTS group_members (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(group_id, user_id)
                )
            `);

            // Sessions table
            await client.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            // Paired devices table
            await client.query(`
                CREATE TABLE IF NOT EXISTS paired_devices (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    device_name TEXT,
                    device_type TEXT,
                    pair_key TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            // User rooms table
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_rooms (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    room_secret TEXT NOT NULL,
                    room_name TEXT,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, room_secret)
                )
            `);

            // Audit logs table
            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    username TEXT,
                    action TEXT NOT NULL,
                    resource_type TEXT,
                    resource_id INTEGER,
                    details TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `);

            await client.query('COMMIT');
            console.log('✅ PostgreSQL schema initialized');

            // Create default super admin if not exists
            await this.createDefaultAdmin();

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async initializeSQLite() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Users table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        display_name TEXT,
                        email TEXT,
                        is_admin BOOLEAN DEFAULT 0,
                        is_super_admin BOOLEAN DEFAULT 0,
                        is_active BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Groups table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        description TEXT,
                        parent_group_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE SET NULL
                    )
                `);

                // Group members table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS group_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(group_id, user_id)
                    )
                `);

                // Sessions table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token TEXT UNIQUE NOT NULL,
                        ip_address TEXT,
                        user_agent TEXT,
                        expires_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);

                // Paired devices table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS paired_devices (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        device_name TEXT,
                        device_type TEXT,
                        pair_key TEXT UNIQUE NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);

                // User rooms table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS user_rooms (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        room_secret TEXT NOT NULL,
                        room_name TEXT,
                        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(user_id, room_secret)
                    )
                `);

                // Audit logs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        username TEXT,
                        action TEXT NOT NULL,
                        resource_type TEXT,
                        resource_id INTEGER,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                    )
                `, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('✅ SQLite schema initialized');
                        this.createDefaultAdmin();
                        resolve();
                    }
                });
            });
        });
    }

    async createDefaultAdmin() {
        try {
            const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
            const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';

            // Check if admin exists
            const existing = await this.query(
                'SELECT id FROM users WHERE username = ?',
                [adminUsername]
            );

            if (existing && existing.length > 0) {
                console.log(`✅ Super admin "${adminUsername}" already exists`);
                return;
            }

            // Create admin
            const hash = await bcrypt.hash(adminPassword, 10);
            
            await this.query(
                `INSERT INTO users (username, password_hash, display_name, is_admin, is_super_admin, is_active)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [adminUsername, hash, 'Super Administrator', true, true, true]
            );

            console.log(`✅ Created default super admin: ${adminUsername}`);
        } catch (err) {
            console.error('Error creating default admin:', err);
        }
    }

    // Helper method to get last insert ID (works with both SQLite and PostgreSQL)
    async getLastInsertId(tableName) {
        if (this.dbType === 'postgres') {
            const result = await this.pool.query(`SELECT currval(pg_get_serial_sequence('${tableName}', 'id')) as id`);
            return result.rows[0].id;
        } else {
            // For SQLite, this is handled in querySQLite return value
            return null;
        }
    }

    async close() {
        if (this.dbType === 'postgres') {
            await this.pool.end();
        } else if (this.db) {
            this.db.close();
        }
    }

    // All the existing methods from the original database.js will be added below
    // (getUserByUsername, createUser, etc.)
    // They will use this.query() which works with both databases
}

export default Database;
