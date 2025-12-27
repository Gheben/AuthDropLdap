/**
 * Script per creare un database pulito
 * - Crea un nuovo database authdrop-clean.db
 * - Contiene solo l'utente super admin iniziale
 * 
 * Dopo l'esecuzione:
 * 1. Ferma il server se in esecuzione
 * 2. Rinomina authdrop.db in authdrop.db.backup (manualmente)
 * 3. Rinomina authdrop-clean.db in authdrop.db
 * 4. Committa il nuovo authdrop.db pulito
 * 
 * Uso: node reset-database.js
 */

import 'dotenv/config';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import fs from 'fs';

const CLEAN_DB_PATH = './authdrop-clean.db';

console.log('🗑️  Creating clean database...\n');

// Rimuovi database pulito se esiste già
if (fs.existsSync(CLEAN_DB_PATH)) {
    fs.unlinkSync(CLEAN_DB_PATH);
    console.log('✅ Removed existing clean database');
}

// Crea nuovo database pulito
const db = new sqlite3.Database(CLEAN_DB_PATH);

db.serialize(() => {
    // Crea le tabelle (copia dallo schema in database.js)
    console.log('📝 Creating database schema...');
    
    // Users table
    db.run(`
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
    db.run(`
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
    db.run(`
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
    db.run(`
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
    db.run(`
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
    db.run(`
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
    db.run(`
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
    `);

    console.log('✅ Database schema created');

    // Crea super admin
    const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';

    bcrypt.hash(adminPassword, 10, (err, hash) => {
        if (err) {
            console.error('❌ Error hashing password:', err);
            db.close();
            process.exit(1);
        }

        db.run(
            `INSERT INTO users (username, password_hash, display_name, is_admin, is_super_admin, is_active)
             VALUES (?, ?, ?, 1, 1, 1)`,
            [adminUsername, hash, 'Super Administrator'],
            (err) => {
                if (err) {
                    console.error('❌ Error creating super admin:', err);
                    db.close();
                    process.exit(1);
                }

                console.log('✅ Created super admin user:');
                console.log(`   Username: ${adminUsername}`);
                console.log(`   Password: ${adminPassword}`);
                console.log(`\n✨ Clean database created: ${CLEAN_DB_PATH}`);
                console.log('\n📋 Next steps:');
                console.log('   1. Stop the server if running');
                console.log('   2. Close any SQLite viewers in VSCode');
                console.log('   3. Rename authdrop.db to authdrop.db.backup');
                console.log('   4. Rename authdrop-clean.db to authdrop.db');
                console.log('   5. Commit the clean authdrop.db to git\n');

                db.close();
                process.exit(0);
            }
        );
    });
});

