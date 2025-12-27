import express from 'express';
import database from './database.js';
import auth from './auth.js';

const router = express.Router();

// ============================================
// Authentication Routes
// ============================================

/**
 * POST /api/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username e password sono obbligatori' 
            });
        }

        // Verify credentials
        const user = await database.verifyPassword(username, password);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Credenziali non valide' 
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                error: 'Account disabilitato' 
            });
        }

        // Generate JWT token
        const token = auth.generateToken(user);

        // Set cookie (httpOnly for security)
        res.cookie('authdrop_token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'strict'
        });

        // Log successful login
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(user.id, user.username, 'login', null, null, 'Login effettuato con successo', ip, userAgent);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore durante il login' 
        });
    }
});

/**
 * POST /api/logout
 * Logout current user
 */
router.post('/logout', auth.requireAuth, async (req, res) => {
    // Log logout
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'];
    await database.logAction(req.user.id, req.user.username, 'logout', null, null, 'Logout effettuato', ip, userAgent);
    
    res.clearCookie('authdrop_token');
    res.json({ success: true, message: 'Logout effettuato con successo' });
});

/**
 * GET /api/me
 * Get current user info
 */
router.get('/me', auth.requireAuth, async (req, res) => {
    try {
        const user = await database.getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utente non trovato' 
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero utente' 
        });
    }
});

/**
 * GET /api/me/rooms
 * Get current user's rooms
 */
router.get('/me/rooms', auth.requireAuth, async (req, res) => {
    try {
        const rooms = await database.getUserRooms(req.user.id);
        
        res.json({
            success: true,
            rooms: rooms
        });
    } catch (error) {
        console.error('Get user rooms error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero stanze' 
        });
    }
});

/**
 * GET /api/me/devices
 * Get current user's paired devices
 */
router.get('/me/devices', auth.requireAuth, async (req, res) => {
    try {
        const devices = await database.getPairedDevices(req.user.id);
        
        res.json({
            success: true,
            devices: devices
        });
    } catch (error) {
        console.error('Get user devices error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero dispositivi' 
        });
    }
});

/**
 * DELETE /api/me/rooms/:roomSecret
 * Delete a room from current user's rooms
 */
router.delete('/me/rooms/:roomSecret', auth.requireAuth, async (req, res) => {
    try {
        const roomSecret = req.params.roomSecret;
        console.log(`[API] User ${req.user.id} deleting room: ${roomSecret.substring(0, 20)}...`);
        
        // Get room name before deletion for logging
        const rooms = await database.getUserRooms(req.user.id);
        const room = rooms.find(r => r.room_secret === roomSecret);
        const roomName = room ? room.room_name : null;
        
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        
        await database.removeUserRoom(req.user.id, roomSecret, req.user.username, roomName, ip, userAgent);
        
        console.log(`[API] ✅ Room deleted successfully for user ${req.user.id}`);
        res.json({
            success: true,
            message: 'Stanza rimossa con successo'
        });
    } catch (error) {
        console.error('[API] ❌ Error deleting user room:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nella rimozione della stanza' 
        });
    }
});

// ============================================
// User Management Routes (Admin only)
// ============================================

/**
 * GET /api/audit-logs
 * Get audit logs (super admin only)
 */
router.get('/audit-logs', auth.requireSuperAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const logs = await database.getAuditLogs(limit, offset);
        
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero dei log' 
        });
    }
});

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/users', auth.requireAdmin, async (req, res) => {
    try {
        const users = await database.getAllUsers();
        
        // Add device and room counts for each user
        const sanitizedUsers = await Promise.all(users.map(async (user) => {
            const pairedDevices = await database.getPairedDevices(user.id);
            const rooms = await database.getUserRooms(user.id);
            
            return {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin,
                isActive: user.is_active,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                deviceCount: pairedDevices.length,
                roomCount: rooms.length
            };
        }));

        res.json({ success: true, users: sanitizedUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero utenti' 
        });
    }
});

/**
 * GET /api/users/:id
 * Get single user by ID (admin only)
 */
router.get('/users/:id', auth.requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await database.getUserById(userId);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utente non trovato' 
            });
        }

        // Get paired devices and rooms
        const pairedDevices = await database.getPairedDevices(userId);
        const rooms = await database.getUserRooms(userId);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin,
                isActive: user.is_active,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                pairedDevices: pairedDevices,
                rooms: rooms
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero utente' 
        });
    }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/users', auth.requireAdmin, async (req, res) => {
    try {
        const { username, password, displayName, email, isAdmin } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username e password sono obbligatori' 
            });
        }

        // Check if username already exists
        const existingUser = await database.getUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                error: 'Username già esistente' 
            });
        }

        const userId = await database.createUser(
            username, 
            password, 
            displayName || username,
            email,
            isAdmin || false
        );

        const user = await database.getUserById(userId);

        // Log user creation
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(
            req.user.id, 
            req.user.username, 
            'create_user', 
            'user', 
            userId, 
            `Creato utente: ${username}${isAdmin ? ' (Admin)' : ''}`, 
            ip, 
            userAgent
        );

        res.status(201).json({
            success: true,
            message: 'Utente creato con successo',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin,
                isSuperAdmin: user.is_super_admin
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nella creazione utente' 
        });
    }
});

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', auth.requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const updates = req.body;

        const user = await database.getUserById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utente non trovato' 
            });
        }

        // Prevent modifying super_admin status unless you are super_admin
        if (updates.hasOwnProperty('isSuperAdmin') && !req.user.isSuperAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Solo il super admin può modificare lo status di super admin' 
            });
        }

        // Prevent deactivating super_admin
        if (user.is_super_admin && updates.isActive === false) {
            return res.status(403).json({ 
                success: false, 
                error: 'Impossibile disabilitare il super admin' 
            });
        }

        await database.updateUser(userId, updates);
        const updatedUser = await database.getUserById(userId);

        // Log user update
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        const changes = [];
        if (updates.displayName) changes.push('nome visualizzato');
        if (updates.email) changes.push('email');
        if (updates.hasOwnProperty('isAdmin')) changes.push('privilegi admin');
        if (updates.hasOwnProperty('isActive')) changes.push('stato attivo');
        if (updates.password) changes.push('password');
        
        await database.logAction(
            req.user.id, 
            req.user.username, 
            'update_user', 
            'user', 
            userId, 
            `Modificato utente ${user.username}: ${changes.join(', ')}`, 
            ip, 
            userAgent
        );

        res.json({
            success: true,
            message: 'Utente aggiornato con successo',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                displayName: updatedUser.display_name,
                email: updatedUser.email,
                isAdmin: updatedUser.is_admin,
                isSuperAdmin: updatedUser.is_super_admin,
                isActive: updatedUser.is_active
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nell\'aggiornamento utente' 
        });
    }
});

/**
 * DELETE /api/users/:id
 * Delete user (super admin only)
 */
router.delete('/users/:id', auth.requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const user = await database.getUserById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utente non trovato' 
            });
        }

        // Prevent deleting super_admin
        if (user.is_super_admin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Impossibile eliminare il super admin' 
            });
        }

        await database.deleteUser(userId);

        // Log user deletion
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(
            req.user.id, 
            req.user.username, 
            'delete_user', 
            'user', 
            userId, 
            `Eliminato utente: ${user.username}`, 
            ip, 
            userAgent
        );

        res.json({
            success: true,
            message: 'Utente eliminato con successo'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nell\'eliminazione utente' 
        });
    }
});

/**
 * GET /api/users/:id/groups
 * Get groups for a specific user
 */
router.get('/users/:id/groups', auth.requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Users can only see their own groups unless they are admin
        if (userId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Non autorizzato' 
            });
        }

        const groups = await database.getUserGroups(userId);

        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get user groups error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero gruppi utente' 
        });
    }
});

// ============================================
// Group Management Routes (Admin only)
// ============================================

/**
 * GET /api/groups
 * Get all groups (admin only)
 */
router.get('/groups', auth.requireAdmin, async (req, res) => {
    try {
        const groups = await database.getAllGroups();
        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero gruppi' 
        });
    }
});

/**
 * GET /api/groups/:id
 * Get single group by ID (admin only)
 */
router.get('/groups/:id', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const group = await database.getGroupById(groupId);

        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Gruppo non trovato' 
            });
        }

        res.json({ success: true, group });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero gruppo' 
        });
    }
});

/**
 * POST /api/groups
 * Create new group (admin only)
 */
router.post('/groups', auth.requireAdmin, async (req, res) => {
    try {
        const { name, description, parentGroupId } = req.body;

        if (!name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Il nome del gruppo è obbligatorio' 
            });
        }

        const groupId = await database.createGroup(name, description, parentGroupId);
        const group = await database.getGroupById(groupId);

        // Log group creation
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(
            req.user.id, 
            req.user.username, 
            'create_group', 
            'group', 
            groupId, 
            `Creato gruppo: ${name}`, 
            ip, 
            userAgent
        );

        res.status(201).json({
            success: true,
            message: 'Gruppo creato con successo',
            group
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nella creazione gruppo' 
        });
    }
});

/**
 * PUT /api/groups/:id
 * Update group (admin only)
 */
router.put('/groups/:id', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const updates = {
            name: req.body.name,
            description: req.body.description,
            parent_group_id: req.body.parentGroupId
        };

        const group = await database.getGroupById(groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Gruppo non trovato' 
            });
        }

        await database.updateGroup(groupId, updates);
        const updatedGroup = await database.getGroupById(groupId);

        // Log group update
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        const changes = [];
        if (updates.name) changes.push('nome');
        if (updates.description !== undefined) changes.push('descrizione');
        if (updates.parent_group_id !== undefined) {
            if (updates.parent_group_id === null) {
                // Se viene rimosso il gruppo padre, indicare da quale gruppo viene rimosso
                if (group.parent_group_id) {
                    const oldParentGroup = await database.getGroupById(group.parent_group_id);
                    changes.push(`rimosso da sottogruppo "${oldParentGroup ? oldParentGroup.name : 'sconosciuto'}"`);
                } else {
                    changes.push('rimosso da sottogruppo');
                }
            } else {
                const parentGroup = await database.getGroupById(updates.parent_group_id);
                changes.push(`spostato sotto il gruppo "${parentGroup ? parentGroup.name : 'sconosciuto'}"`);
            }
        }
        
        await database.logAction(
            req.user.id,
            req.user.username,
            'update_group',
            'group',
            groupId,
            `Modificato gruppo ${group.name}: ${changes.join(', ')}`,
            ip,
            userAgent
        );

        res.json({
            success: true,
            message: 'Gruppo aggiornato con successo',
            group: updatedGroup
        });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nell\'aggiornamento gruppo' 
        });
    }
});

/**
 * DELETE /api/groups/:id
 * Delete group (admin only)
 */
router.delete('/groups/:id', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        const group = await database.getGroupById(groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Gruppo non trovato' 
            });
        }

        await database.deleteGroup(groupId);

        // Log group deletion
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(
            req.user.id, 
            req.user.username, 
            'delete_group', 
            'group', 
            groupId, 
            `Eliminato gruppo: ${group.name}`, 
            ip, 
            userAgent
        );

        res.json({
            success: true,
            message: 'Gruppo eliminato con successo'
        });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nell\'eliminazione gruppo' 
        });
    }
});

/**
 * GET /api/groups/:id/members
 * Get members of a specific group (admin only)
 */
router.get('/groups/:id/members', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const members = await database.getGroupMembers(groupId);

        res.json({ success: true, members });
    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero membri gruppo' 
        });
    }
});

/**
 * POST /api/groups/:id/members
 * Add user to group (admin only)
 */
router.post('/groups/:id/members', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { userId, isGroupAdmin } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID è obbligatorio' 
            });
        }

        // Check if group exists
        const group = await database.getGroupById(groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Gruppo non trovato' 
            });
        }

        // Check if user exists
        const user = await database.getUserById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utente non trovato' 
            });
        }

        await database.addUserToGroup(userId, groupId, isGroupAdmin || false);

        // Log user addition to group
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = req.headers['user-agent'];
        await database.logAction(
            req.user.id,
            req.user.username,
            'add_user_to_group',
            'group',
            groupId,
            `Aggiunto utente ${user.username} al gruppo ${group.name}${isGroupAdmin ? ' (come admin)' : ''}`,
            ip,
            userAgent
        );

        res.status(201).json({
            success: true,
            message: 'Utente aggiunto al gruppo con successo'
        });
    } catch (error) {
        console.error('Add user to group error:', error);
        
        if (error.message && error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ 
                success: false, 
                error: 'Utente già presente nel gruppo' 
            });
        }

        res.status(500).json({ 
            success: false, 
            error: 'Errore nell\'aggiunta utente al gruppo' 
        });
    }
});

/**
 * DELETE /api/groups/:groupId/members/:userId
 * Remove user from group (admin only)
 */
router.delete('/groups/:groupId/members/:userId', auth.requireAdmin, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const userId = parseInt(req.params.userId);

        // Get group and user info before removal for logging
        const group = await database.getGroupById(groupId);
        const user = await database.getUserById(userId);

        await database.removeUserFromGroup(userId, groupId);

        // Log user removal from group
        if (group && user) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
            const userAgent = req.headers['user-agent'];
            await database.logAction(
                req.user.id,
                req.user.username,
                'remove_user_from_group',
                'group',
                groupId,
                `Rimosso utente ${user.username} dal gruppo ${group.name}`,
                ip,
                userAgent
            );
        }

        res.json({
            success: true,
            message: 'Utente rimosso dal gruppo con successo'
        });
    } catch (error) {
        console.error('Remove user from group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nella rimozione utente dal gruppo' 
        });
    }
});

/**
 * GET /api/groups/:id/children
 * Get child groups (subgroups) of a specific group
 */
router.get('/groups/:id/children', auth.requireAdmin, async (req, res) => {
    try {
        const parentId = parseInt(req.params.id);
        const children = await database.getChildGroups(parentId);

        res.json({ success: true, children });
    } catch (error) {
        console.error('Get child groups error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore nel recupero sottogruppi' 
        });
    }
});

export default router;
