import 'dotenv/config';
import database from './server/database.js';
import bcrypt from 'bcrypt';

async function updateAdmin() {
    const username = process.env.SUPER_ADMIN_USERNAME || 'admin';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'admin1234';
    
    console.log(`Aggiornamento super admin con username: ${username}`);
    
    // Aspetta che il database sia inizializzato
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        // Genera hash password
        const hash = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) reject(err);
                else resolve(hash);
            });
        });
        
        // Aggiorna il super admin esistente
        await new Promise((resolve, reject) => {
            database.db.run(
                'UPDATE users SET username = ?, password_hash = ? WHERE is_super_admin = 1',
                [username, hash],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        console.log('✅ Super admin aggiornato con successo!');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Errore durante aggiornamento:', err);
        process.exit(1);
    }
}

updateAdmin();
