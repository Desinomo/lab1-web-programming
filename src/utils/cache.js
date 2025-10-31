// utils/cache.js
const NodeCache = require('node-cache');

// stdTTL: час життя кешу за замовчуванням (в секундах). 0 = нескінченно.
// checkperiod: як часто перевіряти застарілий кеш (в секундах).
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 хвилин TTL

/**
 * Отримує дані з кешу
 * @param {string} key Ключ кешу
 * @returns {any | undefined} Дані з кешу або undefined
 */
const get = (key) => {
    return cache.get(key);
};

/**
 * Записує дані в кеш
 * @param {string} key Ключ кешу
 * @param {any} value Дані для збереження
 * @param {number} [ttl] (optional) Час життя в секундах
 */
const set = (key, value, ttl) => {
    cache.set(key, value, ttl);
};

/**
 * Видаляє дані з кешу за ключем
 * @param {string} key Ключ кешу
 */
const del = (key) => {
    cache.del(key);
};

/**
 * Повністю очищує весь кеш
 */
const flush = () => {
    cache.flushAll();
};

module.exports = {
    get,
    set,
    del,
    flush
};