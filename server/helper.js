import crypto from "crypto";

export const hasher = {
    hashCodeSalted(str, salt = "PairDrop") {
        return this.hashCode(str + salt);
    },

    hashCode(str) {
        return crypto.createHash('sha3-512').update(str).digest('hex');
    }
};

export const randomizer = {
    getRandomString(length, onlyNumeric = false) {
        const validChars = onlyNumeric ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let array = new Uint8Array(length);
        crypto.getRandomValues(array);
        array = array.map(x => validChars.charCodeAt(x % validChars.length));
        return String.fromCharCode.apply(null, array);
    }
};

export const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
