const gifCache = require('../services/gif-cache');

beforeEach(() => {
    gifCache.clear();
});

describe('gif-cache', () => {
    // ── makeCacheKey ─────────────────────────────────────────────
    test('makeCacheKey trie les clés et ignore _t', () => {
        const key1 = gifCache.makeCacheKey({ b: '2', a: '1', _t: '999' });
        const key2 = gifCache.makeCacheKey({ a: '1', b: '2' });
        expect(key1).toBe(key2);
    });

    test('paramètres différents → clés différentes', () => {
        const key1 = gifCache.makeCacheKey({ color: 'red' });
        const key2 = gifCache.makeCacheKey({ color: 'blue' });
        expect(key1).not.toBe(key2);
    });

    // ── get / set basiques ───────────────────────────────────────
    test('set puis get → retourne le buffer', () => {
        const buf = Buffer.from('gif_data');
        gifCache.set('k1', buf);
        expect(gifCache.get('k1')).toEqual(buf);
        expect(gifCache.size()).toBe(1);
    });

    test('get clé inexistante → null', () => {
        expect(gifCache.get('inexistant')).toBeNull();
    });

    // ── TTL ──────────────────────────────────────────────────────
    test('entrée avec TTL expiré → null', () => {
        gifCache.set('ttl_key', Buffer.from('data'), 1); // 1ms TTL
        // Attendre que le TTL expire
        const start = Date.now();
        while (Date.now() - start < 5) {} // busy wait 5ms
        expect(gifCache.get('ttl_key')).toBeNull();
    });

    test('entrée avec TTL non expiré → retourne le buffer', () => {
        gifCache.set('ttl_key', Buffer.from('data'), 60000); // 60s TTL
        expect(gifCache.get('ttl_key')).toEqual(Buffer.from('data'));
    });

    test('entrée sans TTL → pas d\'expiration', () => {
        gifCache.set('no_ttl', Buffer.from('forever'));
        expect(gifCache.get('no_ttl')).toEqual(Buffer.from('forever'));
    });

    // ── LRU eviction ─────────────────────────────────────────────
    test('éviction LRU quand cache plein', () => {
        // Remplir au-delà de MAX_SIZE (200)
        for (let i = 0; i < 201; i++) {
            gifCache.set(`key_${i}`, Buffer.from(`data_${i}`));
        }
        // La première entrée (key_0) doit avoir été évincée
        expect(gifCache.get('key_0')).toBeNull();
        // La dernière entrée doit exister
        expect(gifCache.get('key_200')).toEqual(Buffer.from('data_200'));
        expect(gifCache.size()).toBe(200);
    });

    // ── clear ────────────────────────────────────────────────────
    test('clear vide le cache', () => {
        gifCache.set('a', Buffer.from('1'));
        gifCache.set('b', Buffer.from('2'));
        gifCache.clear();
        expect(gifCache.size()).toBe(0);
        expect(gifCache.get('a')).toBeNull();
    });
});
