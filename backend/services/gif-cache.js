/**
 * gif-cache.js — Cache LRU en mémoire pour les GIFs (preview + production)
 * Chemin : backend/services/gif-cache.js
 *
 * - Preview : cache sans TTL (évite de régénérer à chaque frappe)
 * - Production /gif/:id : cache avec TTL de 60s (le GIF change chaque minute)
 * Taille max : 200 entrées (~30-80kb chacune ≈ 6-16 MB max)
 */

const MAX_SIZE = 200;
const cache    = new Map();

/**
 * Génère une clé de cache depuis les paramètres de la requête.
 * On exclut _t (cache-buster) et on trie les clés pour stabilité.
 */
function makeCacheKey(params) {
    const filtered = Object.entries(params)
        .filter(([k]) => k !== '_t')
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(filtered);
}

function get(key) {
    if (!cache.has(key)) return null;
    const entry = cache.get(key);
    // Vérifie le TTL si défini
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    // LRU : déplace en fin de Map
    cache.delete(key);
    cache.set(key, entry);
    return entry.buffer;
}

function set(key, buffer, ttlMs) {
    // Évince la plus ancienne entrée si plein
    if (cache.size >= MAX_SIZE) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, {
        buffer,
        expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
}

function size() { return cache.size; }
function clear() { cache.clear(); }

module.exports = { makeCacheKey, get, set, size, clear };