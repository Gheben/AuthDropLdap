import jwt from 'jsonwebtoken';
import database from './database.js';

// Chiave segreta JWT (in produzione usare variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'authdrop-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

class AuthMiddleware {
    
    constructor() {
        // Bind methods to preserve 'this' context when used as middleware
        this.requireAuth = this.requireAuth.bind(this);
        this.requireAdmin = this.requireAdmin.bind(this);
        this.requireSuperAdmin = this.requireSuperAdmin.bind(this);
    }
    
    // Genera un token JWT per un utente
    generateToken(user) {
        const payload = {
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin,
            isSuperAdmin: user.is_super_admin
        };
        
        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }

    // Verifica token JWT
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    // Middleware Express per verificare autenticazione
    async requireAuth(req, res, next) {
        try {
            // Cerca token in:
            // 1. Header Authorization: Bearer <token>
            // 2. Cookie
            // 3. Query string (per WebSocket handshake)
            
            let token = null;
            
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
                token = req.headers.authorization.substring(7);
            } else if (req.cookies && req.cookies.authdrop_token) {
                token = req.cookies.authdrop_token;
            } else if (req.query && req.query.token) {
                token = req.query.token;
            }

            if (!token) {
                return res.status(401).json({ success: false, error: 'No token provided' });
            }

            const decoded = this.verifyToken(token);
            if (!decoded) {
                return res.status(401).json({ success: false, error: 'Invalid or expired token' });
            }

            // Verifica che l'utente esista ancora e sia attivo
            const user = await database.getUserById(decoded.id);
            
            if (!user || !user.is_active) {
                return res.status(401).json({ success: false, error: 'User not found or inactive' });
            }

            req.user = {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin
            };
            
            next();

        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(401).json({ success: false, error: 'Authentication failed' });
        }
    }

    // Middleware per richiedere privilegi admin
    async requireAdmin(req, res, next) {
        // Prima autentica l'utente
        try {
            await this.requireAuth(req, res, () => {
                // Poi verifica che sia admin
                if (!req.user || (!req.user.isAdmin && !req.user.isSuperAdmin)) {
                    return res.status(403).json({ success: false, error: 'Admin privileges required' });
                }
                next();
            });
        } catch (error) {
            console.error('requireAdmin error:', error);
        }
    }

    // Middleware per richiedere super admin
    async requireSuperAdmin(req, res, next) {
        // Prima autentica l'utente
        try {
            await this.requireAuth(req, res, () => {
                // Poi verifica che sia super admin
                if (!req.user || !req.user.isSuperAdmin) {
                    return res.status(403).json({ success: false, error: 'Super admin privileges required' });
                }
                next();
            });
        } catch (error) {
            console.error('requireSuperAdmin error:', error);
        }
    }

    // Verifica se un utente può gestire un gruppo specifico
    async canManageGroup(userId, groupId) {
        try {
            const user = await database.getUserById(userId);
            
            // Super admin può tutto
            if (user.is_super_admin) {
                return true;
            }

            // Verifica se è group admin
            const userGroups = await database.getUserGroups(userId);
            const group = userGroups.find(g => g.id === groupId);
            
            return group && (group.is_group_admin || user.is_admin);
        } catch (error) {
            console.error('Error checking group permissions:', error);
            return false;
        }
    }

    // Estrae token dalla richiesta (usato per WebSocket)
    extractToken(req) {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            return req.headers.authorization.substring(7);
        } else if (req.cookies && req.cookies.authdrop_token) {
            return req.cookies.authdrop_token;
        } else if (req.query && req.query.token) {
            return req.query.token;
        } else if (req.headers.cookie) {
            // Parse cookie header manualmente
            const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});
            return cookies.authdrop_token;
        }
        return null;
    }

    // Verifica token e restituisce user (per WebSocket)
    async getUserFromToken(token) {
        try {
            const decoded = this.verifyToken(token);
            if (!decoded) {
                return null;
            }

            const user = await database.getUserById(decoded.id);
            if (!user || !user.is_active) {
                return null;
            }

            return {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin
            };
        } catch (error) {
            console.error('Error getting user from token:', error);
            return null;
        }
    }
}

export default new AuthMiddleware();
