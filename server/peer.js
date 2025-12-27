import crypto from "crypto";
import UAParser from "ua-parser-js";
import { uniqueNamesGenerator, animals, colors } from 'unique-names-generator';

export default class Peer {

    constructor(socket, request, conf) {
        // set socket
        this.socket = socket;

        // set remote ip
        this._setIP(request, conf);

        // set peer id
        this._setPeerId(request);

        // is WebRTC supported?
        this.rtcSupported = request.url.indexOf('webrtc') > -1;

        // set name
        this._setName(request);

        // for room secret
        this.roomSecrets = [];
        this.publicRoomId = null;

        this.pairKey = null;

        this.rateLimitIntervals = [];
    }

    _setIP(request, conf) {
        if (request.headers['cf-connecting-ip']) {
            this.ip = request.headers['cf-connecting-ip'].split(/\s*,\s*/)[0];
        } else if (request.headers['x-forwarded-for']) {
            this.ip = request.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        } else {
            this.ip = request.socket.remoteAddress;
        }

        // IPv4 and IPv6 use different values to refer to localhost
        if (this.ip === '::1' || this.ip === '::ffff:127.0.0.1') {
            this.ip = '127.0.0.1';
        }

        // remove the IPv6 prefix if it exists
        this.ip = this.ip.replace(/^::ffff:/, '');

        if (conf.ipv6Localize && !this._isPrivateIPv4(this.ip) && this._isIPv6(this.ip)) {
            this.ip = this.ip.split(':').slice(0, 4).join(':');
        }
    }

    _isPrivateIPv4(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;

        // Check for private IP ranges
        // 10.0.0.0 - 10.255.255.255
        if (parts[0] === '10') return true;

        // 172.16.0.0 - 172.31.255.255
        if (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) return true;

        // 192.168.0.0 - 192.168.255.255
        if (parts[0] === '192' && parts[1] === '168') return true;

        // 127.0.0.0 - 127.255.255.255
        if (parts[0] === '127') return true;

        return false;
    }

    _isIPv6(ip) {
        return ip.includes(':');
    }

    _setPeerId(request) {
        this.id = this._getUuidFromCookie(request.headers.cookie);
    }

    _getUuidFromCookie(cookie) {
        if (!cookie) return this._createUuid();

        const pattern = /uuid=(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/g;
        const match = pattern.exec(cookie);

        if (match && match.length > 1) {
            const uuid = match[1];
            if (Peer.isValidUuid(uuid)) {
                return uuid;
            }
        }

        return this._createUuid();
    }

    _createUuid() {
        return crypto.randomUUID();
    }

    toString() {
        return `<Peer id=${this.id} ip=${this.ip} rtcSupported=${this.rtcSupported}>`;
    }

    _setName(req) {
        const ua = UAParser(req.headers['user-agent']);

        let deviceName = '';

        if (ua.os && ua.os.name) {
            deviceName = ua.os.name.replace('Mac OS', 'Mac');
        }

        if (ua.device.model) {
            deviceName = ua.device.model;
        }

        if (ua.device.type) {
            deviceName = ua.device.type;
        }

        if (ua.device.vendor) {
            deviceName = ua.device.vendor;
        }

        deviceName = deviceName.replace('Apple', '');

        if (ua.browser.name) {
            deviceName = ua.browser.name + " su " + deviceName;
        }

        if (!deviceName) {
            deviceName = 'Browser sconosciuto';
        }

        // Usa il nome del dispositivo come displayName principale
        const randomName = uniqueNamesGenerator({
            length: 2,
            separator: ' ',
            dictionaries: [colors, animals],
            style: 'capital'
        });

        this.name = {
            displayName: deviceName || randomName,
            deviceName
        };
    }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            rtcSupported: this.rtcSupported
        }
    }

    addRoomSecret(roomSecret) {
        if (!this.roomSecrets.includes(roomSecret)) {
            this.roomSecrets.push(roomSecret);
        }
    }

    removeRoomSecret(roomSecret) {
        const index = this.roomSecrets.indexOf(roomSecret);
        if (index > -1) {
            this.roomSecrets.splice(index, 1);
        }
    }

    rateLimitReached() {
        this.rateLimitIntervals.push(Date.now());
        // remove intervals older than 10s
        this.rateLimitIntervals = this.rateLimitIntervals.filter(interval => Date.now() - interval < 10000);
        return this.rateLimitIntervals.length > 5;
    }

    static isValidUuid(uuid) {
        return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(uuid);
    }
}
