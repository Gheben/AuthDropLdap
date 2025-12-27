import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'authdrop.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run('DELETE FROM user_rooms', (err) => {
        if (err) {
            console.error('Error deleting user_rooms:', err);
        } else {
            console.log('✅ Tutte le stanze cancellate');
        }
    });

    db.run('DELETE FROM paired_devices', (err) => {
        if (err) {
            console.error('Error deleting paired_devices:', err);
        } else {
            console.log('✅ Tutti i dispositivi abbinati cancellati');
        }
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database pulito completato');
            process.exit(0);
        }
    });
});
