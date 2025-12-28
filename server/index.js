import 'dotenv/config';
import crypto from "crypto"
import process from "process";

const configBuilder = (conf) => {
    // Setup config
    conf.debugMode = process.env.DEBUG_MODE === "true";

    conf.port = process.env.PORT || 3441;
    if (conf.port < 1024 || conf.port > 65535) {
        conf.port = 3441;
    }

    conf.wsFallback = process.env.WS_FALLBACK === 'true';

    if (process.env.RTC_CONFIG) {
        try {
            conf.rtcConfig = JSON.parse(process.env.RTC_CONFIG);
        } catch (e) {
            console.error(e);
            console.error("RTC_CONFIG is not a valid JSON object. Ignoring RTC_CONFIG.");
        }
    }

    conf.signalingServer = process.env.SIGNALING_SERVER ?? "";

    conf.ipv6Localize = process.env.IPV6_LOCALIZE === "true";

    conf.rateLimit = process.env.RATE_LIMIT === "false" ? false : parseInt(process.env.RATE_LIMIT ?? 1000);

    // Setup buttons config
    conf.buttons = {};
    if (process.env.BUTTON_CONFIG) {
        try {
            conf.buttons = JSON.parse(process.env.BUTTON_CONFIG);
        } catch (e) {
            console.error(e);
            console.error("BUTTON_CONFIG is not a valid JSON object. Ignoring BUTTON_CONFIG.");
        }
    }

    conf.buttons.center = conf.buttons.center ?? true;
    conf.buttons.left = conf.buttons.left ?? [];
    conf.buttons.right = conf.buttons.right ?? [];

    return conf;
}

import AuthDropServer from "./server.js";
import AuthDropWsServer from "./ws-server.js";
import LDAPSync from "./ldap-sync.js";
import database from "./database.js";

const conf = configBuilder({});

const server = new AuthDropServer(conf.port, conf);
const wsServer = new AuthDropWsServer(server.getServer(), conf);

// LDAP Auto-Sync Setup
let ldapSyncInterval = null;
if (process.env.LDAP_ENABLED === 'true' && process.env.LDAP_AUTO_SYNC === 'true') {
    const syncIntervalSeconds = parseInt(process.env.LDAP_SYNC_INTERVAL || '3600');
    const syncIntervalMs = syncIntervalSeconds * 1000;
    
    console.log(`🔄 LDAP Auto-Sync enabled: running every ${syncIntervalSeconds} seconds (${syncIntervalSeconds / 60} minutes)`);
    
    // Function to perform sync
    const performAutoSync = async () => {
        try {
            console.log(`[${new Date().toISOString()}] Starting automatic LDAP sync...`);
            const ldapSync = new LDAPSync(database);
            const result = await ldapSync.fullSync(null, false); // initiatedByUserId=null, dryRun=false
            if (result.success) {
                console.log(`[${new Date().toISOString()}] Auto-sync completed successfully:`, {
                    usersAdded: result.stats.usersAdded,
                    usersUpdated: result.stats.usersUpdated,
                    usersRemoved: result.stats.usersRemoved,
                    groupsAdded: result.stats.groupsAdded,
                    groupsUpdated: result.stats.groupsUpdated,
                    groupsRemoved: result.stats.groupsRemoved
                });
            } else {
                console.error(`[${new Date().toISOString()}] Auto-sync failed:`, result.error);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Auto-sync error:`, error.message);
        }
    };
    
    // Run initial sync after 30 seconds (give time for server to fully start)
    setTimeout(performAutoSync, 30000);
    
    // Schedule recurring sync
    ldapSyncInterval = setInterval(performAutoSync, syncIntervalMs);
}

// Handle SIGINT
process.on('SIGINT', () => {
    console.info("SIGINT Received, exiting...")
    if (ldapSyncInterval) {
        clearInterval(ldapSyncInterval);
        console.info("LDAP Auto-Sync stopped")
    }
    process.exit(0)
})

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.info("SIGTERM Received, exiting...")
    if (ldapSyncInterval) {
        clearInterval(ldapSyncInterval);
        console.info("LDAP Auto-Sync stopped")
    }
    process.exit(0)
})
