/**
 * Simple file-based cache for SAP results
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CACHE_DIR = path.join(os.homedir(), '.cache', 'srit');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Generate a cache key from text content
 * @param {string} text - The text content
 * @returns {string} - Hash-based cache key
 */
function getCacheKey(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Get cached SAP result if available
 * @param {string} text - The text content
 * @returns {object|null} - Cached result or null
 */
function getCache(text) {
  try {
    ensureCacheDir();
    const key = getCacheKey(text);
    const cachePath = path.join(CACHE_DIR, `${key}.json`);

    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8');
      const cached = JSON.parse(data);

      // Verify the cached text length matches (sanity check)
      if (cached.textLength === text.length) {
        return cached;
      }
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

/**
 * Store SAP result in cache
 * @param {string} text - The text content
 * @param {object} result - The SAP result to cache
 */
function setCache(text, result) {
  try {
    ensureCacheDir();
    const key = getCacheKey(text);
    const cachePath = path.join(CACHE_DIR, `${key}.json`);

    const cacheData = {
      textLength: text.length,
      timestamp: Date.now(),
      ...result
    };

    fs.writeFileSync(cachePath, JSON.stringify(cacheData), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Clear all cached SAP results
 */
function clearCache() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

module.exports = { getCache, setCache, clearCache, getCacheKey };
