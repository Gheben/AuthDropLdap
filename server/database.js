import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlite = sqlite3.verbose();

class Database {
    constructor() {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'gbdrop.db');
        this.db = new sqlite.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Database connected:', dbPath);
                this.initialize();
            }
        });
    }

    async initialize() {
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
                        FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE CASCADE
                    )
                `);

                // Group members (many-to-many)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS group_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        group_id INTEGER NOT NULL,
                        is_group_admin BOOLEAN DEFAULT 0,
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                        UNIQUE(user_id, group_id)
                    )
                `);

                // Sessions table (optional, per JWT blacklist)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token TEXT NOT NULL,
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
                        device_name TEXT NOT NULL,
                        device_type TEXT,
                        pair_key TEXT NOT NULL,
                        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(user_id, pair_key)
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
                `, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database tables initialized');
                        this.createDefaultAdmin().then(resolve).catch(reject);
                    }
                });
            });
        });
    }

    async createDefaultAdmin() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT id FROM users WHERE is_super_admin = 1', (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    // Crea admin di default: admin/admin
                    bcrypt.hash('admin', 10, (err, hash) => {
                        if (err) {
                            reject(err);
                        } else {
                            this.db.run(
                                'INSERT INTO users (username, password_hash, display_name, is_admin, is_super_admin) VALUES (?, ?, ?, ?, ?)',
                                ['admin', hash, 'Administrator', 1, 1],
                                (err) => {
                                    if (err) {
                                        // Ignora errore UNIQUE constraint (admin già esiste)
                                        if (err.code === 'SQLITE_CONSTRAINT') {
                                            console.log('Default admin already exists');
                                            resolve();
                                        } else {
                                            reject(err);
                                        }
                                    } else {
                                        console.log('Default super admin created: admin/admin');
                                        resolve();
                                    }
                                }
                            );
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    // === USER METHODS ===
    
    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id, username, display_name, email, is_admin, is_super_admin, is_active, created_at FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    createUser(username, password, displayName = null, email = null, isAdmin = false) {
        return new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    reject(err);
                } else {
                    this.db.run(
                        'INSERT INTO users (username, password_hash, display_name, email, is_admin) VALUES (?, ?, ?, ?, ?)',
                        [username, hash, displayName || username, email, isAdmin ? 1 : 0],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                }
            });
        });
    }

    updateUser(id, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.display_name !== undefined) {
                fields.push('display_name = ?');
                values.push(updates.display_name);
            }
            if (updates.email !== undefined) {
                fields.push('email = ?');
                values.push(updates.email);
            }
            if (updates.is_admin !== undefined) {
                fields.push('is_admin = ?');
                values.push(updates.is_admin ? 1 : 0);
            }
            if (updates.is_active !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.is_active ? 1 : 0);
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
            this.db.run(sql, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    deleteUser(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM users WHERE id = ? AND is_super_admin = 0', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    verifyPassword(username, password) {
        return new Promise((resolve, reject) => {
            this.getUserByUsername(username).then(user => {
                if (!user) {
                    resolve(null);
                } else if (!user.is_active) {
                    resolve(null);
                } else {
                    bcrypt.compare(password, user.password_hash, (err, result) => {
                        if (err) reject(err);
                        else resolve(result ? user : null);
                    });
                }
            }).catch(reject);
        });
    }

    // === GROUP METHODS ===

    getAllGroups() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM groups ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getGroupById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM groups WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createGroup(name, description = null, parentGroupId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO groups (name, description, parent_group_id) VALUES (?, ?, ?)',
                [name, description, parentGroupId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updateGroup(id, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.name !== undefined) {
                fields.push('name = ?');
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.parent_group_id !== undefined) {
                fields.push('parent_group_id = ?');
                values.push(updates.parent_group_id);
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const sql = `UPDATE groups SET ${fields.join(', ')} WHERE id = ?`;
            this.db.run(sql, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    deleteGroup(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM groups WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // === GROUP MEMBERS METHODS ===

    addUserToGroup(userId, groupId, isGroupAdmin = false) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO group_members (user_id, group_id, is_group_admin) VALUES (?, ?, ?)',
                [userId, groupId, isGroupAdmin ? 1 : 0],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    removeUserFromGroup(userId, groupId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM group_members WHERE user_id = ? AND group_id = ?', [userId, groupId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getUserGroups(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT g.*, gm.is_group_admin
                FROM groups g
                JOIN group_members gm ON g.id = gm.group_id
                WHERE gm.user_id = ?
                ORDER BY g.name
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getGroupMembers(groupId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT u.id, u.username, u.display_name, u.email, gm.is_group_admin, gm.joined_at
                FROM users u
                JOIN group_members gm ON u.id = gm.user_id
                WHERE gm.group_id = ? AND u.is_active = 1
                ORDER BY u.username
            `, [groupId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Ottiene tutti gli ID di gruppo (inclusi sottogruppi) per un utente
    async getAllGroupIdsForUser(userId) {
        const userGroups = await this.getUserGroups(userId);
        const groupIds = new Set(userGroups.map(g => g.id));

        // Aggiungi anche i sottogruppi ricorsivamente
        for (const group of userGroups) {
            const childGroups = await this.getChildGroups(group.id);
            childGroups.forEach(g => groupIds.add(g.id));
        }

        return Array.from(groupIds);
    }

    getChildGroups(parentId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                WITH RECURSIVE child_groups AS (
                    SELECT id, name, parent_group_id FROM groups WHERE parent_group_id = ?
                    UNION ALL
                    SELECT g.id, g.name, g.parent_group_id 
                    FROM groups g
                    JOIN child_groups cg ON g.parent_group_id = cg.id
                )
                SELECT * FROM child_groups
            `, [parentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Paired Devices Methods
    async addPairedDevice(userId, deviceName, deviceType, pairKey) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO paired_devices (user_id, device_name, device_type, pair_key, last_seen)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [userId, deviceName, deviceType, pairKey],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getPairedDevices(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM paired_devices WHERE user_id = ? ORDER BY last_seen DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async removePairedDevice(userId, pairKey) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM paired_devices WHERE user_id = ? AND pair_key = ?',
                [userId, pairKey],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // User Rooms Methods
    async addUserRoom(userId, roomSecret, roomName = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO user_rooms (user_id, room_secret, room_name, last_accessed)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [userId, roomSecret, roomName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getUserRooms(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM user_rooms WHERE user_id = ? ORDER BY last_accessed DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async removeUserRoom(userId, roomSecret) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM user_rooms WHERE user_id = ? AND room_secret = ?',
                [userId, roomSecret],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

export default new Database();
