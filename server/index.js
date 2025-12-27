import crypto from "crypto"
import process from "process";

const configBuilder = (conf) => {
    // Setup config
    conf.debugMode = process.env.DEBUG_MODE === "true";

    conf.port = process.env.PORT || 3000;
    if (conf.port < 1024 || conf.port > 65535) {
        conf.port = 3000;
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

import GBDropServer from "./server.js";
import GBDropWsServer from "./ws-server.js";

const conf = configBuilder({});

const server = new GBDropServer(conf.port, conf);
const wsServer = new GBDropWsServer(server.getServer(), conf);

// Handle SIGINT
process.on('SIGINT', () => {
    console.info("SIGINT Received, exiting...")
    process.exit(0)
})

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.info("SIGTERM Received, exiting...")
    process.exit(0)
})
