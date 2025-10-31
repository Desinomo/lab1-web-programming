// utils/cache.js
const NodeCache = require('node-cache');

// stdTTL: ��� ����� ���� �� ������������� (� ��������). 0 = ����������.
// checkperiod: �� ����� ��������� ��������� ��� (� ��������).
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 ������ TTL

/**
 * ������ ��� � ����
 * @param {string} key ���� ����
 * @returns {any | undefined} ��� � ���� ��� undefined
 */
const get = (key) => {
    return cache.get(key);
};

/**
 * ������ ��� � ���
 * @param {string} key ���� ����
 * @param {any} value ��� ��� ����������
 * @param {number} [ttl] (optional) ��� ����� � ��������
 */
const set = (key, value, ttl) => {
    cache.set(key, value, ttl);
};

/**
 * ������� ��� � ���� �� ������
 * @param {string} key ���� ����
 */
const del = (key) => {
    cache.del(key);
};

/**
 * ������� ����� ���� ���
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