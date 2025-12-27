class AuthDrop {

    constructor() {
        // Check authentication before initializing
        this.checkAuth().then(authenticated => {
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            
            // User is authenticated, proceed with initialization
            this.init();
        });
    }

    async checkAuth() {
        try {
            // Skip auth check if no token exists (avoids 401 errors in console)
            const hasToken = localStorage.getItem('authdrop_token');
            if (!hasToken) {
                console.log('No token found, skipping auth check');
                return false;
            }
            
            console.log('Checking authentication...');
            const response = await fetch('/api/me', {
                credentials: 'include'
            });

            console.log('Auth response status:', response.status);

            if (!response.ok) {
                console.log('Authentication failed: response not OK');
                return false;
            }

            const data = await response.json();
            console.log('Auth response data:', data);
            
            if (!data.success || !data.user) {
                console.log('Authentication failed: no user data');
                return false;
            }

            // Store user info
            window.currentUser = data.user;
            console.log('Authenticated as:', data.user.username);
            
            // Load user's rooms from database and sync to IndexedDB
            await this.syncUserRoomsFromDatabase();
            
            // Show admin button if user is admin
            if (data.user.isAdmin) {
                const adminBtn = document.getElementById('admin-panel-btn');
                if (adminBtn) {
                    adminBtn.removeAttribute('hidden');
                }
            }
            
            // Show logout button for all authenticated users
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.removeAttribute('hidden');
                logoutBtn.addEventListener('click', this.logout.bind(this));
            }
            
            return true;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    async syncUserRoomsFromDatabase() {
        try {
            console.log('[SYNC] 🔄 Starting room synchronization from database...');
            
            // Check if PersistentStorage is available
            if (typeof PersistentStorage === 'undefined') {
                console.error('[SYNC] ❌ PersistentStorage not available yet');
                return;
            }
            
            // Clear existing room secrets from IndexedDB
            console.log('[SYNC] 🧹 Clearing IndexedDB...');
            await PersistentStorage.clearRoomSecrets();
            console.log('[SYNC] ✅ IndexedDB cleared');
            
            // Load user's rooms from database
            console.log('[SYNC] 📡 Fetching rooms from /api/me/rooms...');
            const response = await fetch('/api/me/rooms', {
                credentials: 'include'
            });

            console.log('[SYNC] Response status:', response.status);
            if (!response.ok) {
                console.error('[SYNC] ❌ Failed to load user rooms - status:', response.status);
                return;
            }

            const data = await response.json();
            console.log('[SYNC] 📦 Received data:', data);
            console.log('[SYNC] 📊 Number of rooms:', data.rooms ? data.rooms.length : 0);

            // Add each room to IndexedDB and restore public room to sessionStorage
            if (data.rooms && data.rooms.length > 0) {
                console.log('[SYNC] 💾 Adding rooms to IndexedDB...');
                for (const room of data.rooms) {
                    console.log(`[SYNC]   - Adding room: ${room.room_secret.substring(0, 20)}... (${room.room_name || 'Stanza privata'})`);
                    
                    // Check if this is a public room (5 characters) or device pairing (long secret)
                    if (room.room_secret.length <= 10) {
                        // This is a public room - restore to sessionStorage
                        console.log(`[SYNC] 🏠 Restoring public room to sessionStorage: ${room.room_secret}`);
                        sessionStorage.setItem('public_room_id', room.room_secret);
                        
                        // Add to IndexedDB for persistency
                        await PersistentStorage.addRoomSecret(
                            room.room_secret,
                            room.room_name || `Gruppo pubblico: ${room.room_secret}`,
                            ''
                        );
                        
                        // Trigger joining the public room
                        console.log(`[SYNC] 🔗 Rejoining public room: ${room.room_secret}`);
                        Events.fire('join-public-room', {
                            roomId: room.room_secret,
                            createIfInvalid: false
                        });
                    } else {
                        // This is a device pairing secret
                        await PersistentStorage.addRoomSecret(
                            room.room_secret,
                            room.room_name || 'Stanza privata',
                            ''  // deviceName - non disponibile dal database
                        );
                    }
                }
                console.log(`[SYNC] ✅ Successfully synced ${data.rooms.length} room(s) to IndexedDB`);
            } else {
                console.log('[SYNC] ℹ️ No rooms to sync');
            }
        } catch (error) {
            console.error('[SYNC] ❌ Error syncing user rooms:', error);
        }
    }

    async logout() {
        try {
            console.log('[LOGOUT] 🚪 Starting logout process...');
            
            // Clear all room secrets from IndexedDB
            console.log('[LOGOUT] 🧹 Clearing room secrets from IndexedDB...');
            await PersistentStorage.clearRoomSecrets();
            console.log('[LOGOUT] ✅ Room secrets cleared');
            
            // Clear session storage (peer IDs)
            console.log('[LOGOUT] 🧹 Clearing sessionStorage...');
            sessionStorage.clear();
            console.log('[LOGOUT] ✅ SessionStorage cleared');
            
            // Call logout API
            console.log('[LOGOUT] 📡 Calling logout API...');
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            console.log('[LOGOUT] ✅ Logout API called');
        } catch (error) {
            console.error('[LOGOUT] ❌ Logout error:', error);
        }
        
        // Clear token
        console.log('[LOGOUT] 🧹 Removing JWT token...');
        localStorage.removeItem('authdrop_token');
        
        // Redirect to login
        console.log('[LOGOUT] 🔀 Redirecting to /login');
        window.location.href = '/login';
    }

    init() {
        this.$headerNotificationBtn = $('notification');
        this.$headerEditPairedDevicesBtn = $('edit-paired-devices');
        this.$footerPairedDevicesBadge = $$('.discovery-wrapper .badge-room-secret');
        this.$headerInstallBtn = $('install');

        this.deferredStyles = [
            "styles/styles-deferred.css"
        ];
        this.deferredScripts = [
            "scripts/browser-tabs-connector.js",
            "scripts/util.js",
            "scripts/network.js",
            "scripts/ui.js",
            "scripts/libs/heic2any.min.js",
            "scripts/libs/no-sleep.min.js",
            "scripts/libs/qr-code.min.js",
            "scripts/libs/zip.min.js"
        ];

        this.registerServiceWorker();

        Events.on('beforeinstallprompt', e => this.onPwaInstallable(e));

        this.persistentStorage = new PersistentStorage();
        this.localization = new Localization();
        this.themeUI = new ThemeUI();
        this.backgroundCanvas = new BackgroundCanvas();
        this.headerUI = new HeaderUI();
        this.centerUI = new CenterUI();
        this.footerUI = new FooterUI();

        this.initialize()
            .then(_ => {
                console.log("Initialization completed.");
            });
    }

    async initialize() {
        // Translate page before fading in
        await this.localization.setInitialTranslation()
        console.log("Initial translation successful.");

        // Show "Loading..." until connected to WsServer
        await this.footerUI.showLoading();

        // Evaluate css shifting UI elements and fade in UI elements
        await this.evaluatePermissionsAndRoomSecrets();
        await this.headerUI.evaluateOverflowing();
        await this.headerUI.fadeIn();
        await this.footerUI._evaluateFooterBadges();
        await this.footerUI.fadeIn();
        await this.centerUI.fadeIn();
        await this.backgroundCanvas.fadeIn();

        // Load deferred assets
        console.log("Load deferred assets...");
        await this.loadDeferredAssets();
        console.log("Loading of deferred assets completed.");

        console.log("Hydrate UI...");
        await this.hydrate();
        console.log("UI hydrated.");

        // Evaluate url params as soon as ws is connected
        console.log("Evaluate URL params as soon as websocket connection is established.");
        Events.on('ws-connected', _ => this.evaluateUrlParams(), {once: true});
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered');
                    window.serviceWorker = registration;
                    
                    // Check for updates every time the page loads
                    registration.update();
                    
                    // Handle service worker updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New Service Worker found, installing...');
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available, reload the page
                                console.log('New Service Worker installed, reloading page...');
                                window.location.reload();
                            }
                        });
                    });
                });
                
            // Refresh the page when the service worker takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed, reloading...');
                window.location.reload();
            });
        }
    }

    onPwaInstallable(e) {
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            // only display install btn when not installed
            this.$headerInstallBtn.removeAttribute('hidden');
            this.$headerInstallBtn.addEventListener('click', () => {
                this.$headerInstallBtn.setAttribute('hidden', true);
                e.prompt();
            });
        }
        return e.preventDefault();
    }

    async evaluatePermissionsAndRoomSecrets() {
        // Check whether notification permissions have already been granted
        if ('Notification' in window && Notification.permission !== 'granted') {
            this.$headerNotificationBtn.removeAttribute('hidden');
        }

        let roomSecrets = await PersistentStorage.getAllRoomSecrets();
        // Filter only device pairing secrets (long hash strings, not public room codes)
        // Public room codes are 5 characters, device secrets are 256+ characters
        if (roomSecrets && roomSecrets.length > 0) {
            let devicePairingSecrets = roomSecrets.filter(secret => secret.length > 10);
            if (devicePairingSecrets.length > 0) {
                this.$headerEditPairedDevicesBtn.removeAttribute('hidden');
                this.$footerPairedDevicesBadge.removeAttribute('hidden');
            }
        }
    }

    loadDeferredAssets() {
        const stylePromises = this.deferredStyles.map(url => this.loadAndApplyStylesheet(url));
        const scriptPromises = this.deferredScripts.map(url => this.loadAndApplyScript(url));

        return Promise.all([...stylePromises, ...scriptPromises]);
    }

    loadStyleSheet(url) {
        return new Promise((resolve, reject) => {
            let stylesheet = document.createElement('link');
            stylesheet.rel = 'preload';
            stylesheet.as = 'style';
            stylesheet.href = url;
            stylesheet.onload = _ => {
                stylesheet.onload = null;
                stylesheet.rel = 'stylesheet';
                resolve();
            };
            stylesheet.onerror = reject;

            document.head.appendChild(stylesheet);
        });
    }

    loadAndApplyStylesheet(url) {
        return new Promise( async (resolve) => {
            try {
                await this.loadStyleSheet(url);
                console.log(`Stylesheet loaded successfully: ${url}`);
                resolve();
            } catch (error) {
                console.error('Error loading stylesheet:', error);
            }
        });
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            let script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;

            document.body.appendChild(script);
        });
    }

    loadAndApplyScript(url) {
        return new Promise( async (resolve) => {
            try {
                await this.loadScript(url);
                console.log(`Script loaded successfully: ${url}`);
                resolve();
            } catch (error) {
                console.error('Error loading script:', error);
            }
        });
    }

    async hydrate() {
        this.aboutUI = new AboutUI();
        this.peersUI = new PeersUI();
        this.languageSelectDialog = new LanguageSelectDialog();
        this.receiveFileDialog = new ReceiveFileDialog();
        this.receiveRequestDialog = new ReceiveRequestDialog();
        this.sendTextDialog = new SendTextDialog();
        this.receiveTextDialog = new ReceiveTextDialog();
        this.pairDeviceDialog = new PairDeviceDialog();
        this.clearDevicesDialog = new EditPairedDevicesDialog();
        this.publicRoomDialog = new PublicRoomDialog();
        this.base64Dialog = new Base64Dialog();
        this.shareTextDialog = new ShareTextDialog();
        this.toast = new Toast();
        this.notifications = new Notifications();
        this.networkStatusUI = new NetworkStatusUI();
        this.webShareTargetUI = new WebShareTargetUI();
        this.webFileHandlersUI = new WebFileHandlersUI();
        this.noSleepUI = new NoSleepUI();
        this.broadCast = new BrowserTabsConnector();
        this.server = new ServerConnection();
        this.peers = new PeersManager(this.server);
    }

    async evaluateUrlParams() {
        // get url params
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.substring(1);

        // evaluate url params
        if (urlParams.has('pair_key')) {
            const pairKey = urlParams.get('pair_key');
            this.pairDeviceDialog._pairDeviceJoin(pairKey);
        }
        else if (urlParams.has('room_id')) {
            const roomId = urlParams.get('room_id');
            this.publicRoomDialog._joinPublicRoom(roomId);
        }
        else if (urlParams.has('base64text')) {
            const base64Text = urlParams.get('base64text');
            await this.base64Dialog.evaluateBase64Text(base64Text, hash);
        }
        else if (urlParams.has('base64zip')) {
            const base64Zip = urlParams.get('base64zip');
            await this.base64Dialog.evaluateBase64Zip(base64Zip, hash);
        }
        else if (urlParams.has("share_target")) {
            const shareTargetType = urlParams.get("share_target");
            const title = urlParams.get('title') || '';
            const text = urlParams.get('text') || '';
            const url = urlParams.get('url') || '';
            await this.webShareTargetUI.evaluateShareTarget(shareTargetType, title, text, url);
        }
        else if (urlParams.has("file_handler")) {
            await this.webFileHandlersUI.evaluateLaunchQueue();
        }
        else if (urlParams.has("init")) {
            const init = urlParams.get("init");
            if (init === "pair") {
                this.pairDeviceDialog._pairDeviceInitiate();
            }
            else if (init === "public_room") {
                this.publicRoomDialog._createPublicRoom();
            }
        }
        else {
            // No URL params - check if there's a public room in sessionStorage to rejoin
            const publicRoomId = sessionStorage.getItem('public_room_id');
            if (publicRoomId) {
                console.log(`[REJOIN] 🔄 Rejoining public room from sessionStorage: ${publicRoomId}`);
                this.publicRoomDialog._joinPublicRoom(publicRoomId, false);
            }
        }

        // remove url params from url
        const urlWithoutParams = getUrlWithoutArguments();
        window.history.replaceState({}, "Rewrite URL", urlWithoutParams);

        console.log("URL params evaluated.");
    }
}

const authDrop = new AuthDrop();