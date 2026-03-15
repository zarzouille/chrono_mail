/**
 * gif-cache.js — Cache LRU en mémoire pour les GIFs preview
 * Chemin : backend/services/gif-cache.js
 *
 * Évite de régénérer un GIF identique à chaque frappe.
 * Taille max : 50 entrées (chaque GIF preview ~30-80kb)
 */

const MAX_SIZE = 50;
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
    // LRU : déplace en fin de Map
    const val = cache.get(key);
    cache.delete(key);
    cache.set(key, val);
    return val;
}

function set(key, buffer) {
    // Évince la plus ancienne entrée si plein
    if (cache.size >= MAX_SIZE) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, buffer);
}

function size() { return cache.size; }
function clear() { cache.clear(); }

module.exports = { makeCacheKey, get, set, size, clear };