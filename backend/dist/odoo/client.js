"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearOdooClientCache = clearOdooClientCache;
exports.getOdooClient = getOdooClient;
const xmlrpc_1 = __importDefault(require("xmlrpc"));
const UID_TTL_MS = 60 * 60 * 1000; // 1 hour
const CONNECT_TIMEOUT_MS = 10000; // 10s — fail fast on bad URLs
const _cache = new Map();
function configFingerprint(cfg) {
    return JSON.stringify({
        url: cfg.odoo_url,
        db: cfg.odoo_db,
        username: cfg.odoo_username,
        password: cfg.odoo_password,
    });
}
function validateConfig(tenantId, cfg) {
    const missing = ['odoo_url', 'odoo_db', 'odoo_username', 'odoo_password']
        .filter(k => !cfg[k]);
    if (missing.length) {
        throw new Error(`[${tenantId}] Invalid tenant config — missing fields: ${missing.join(', ')}`);
    }
}
function getCache(tenantId, cfg) {
    const fingerprint = configFingerprint(cfg);
    let entry = _cache.get(tenantId);
    if (!entry || entry.fingerprint !== fingerprint) {
        entry = {
            fingerprint,
            commonClient: xmlrpc_1.default.createSecureClient({ url: `${cfg.odoo_url}/xmlrpc/2/common`, timeout: CONNECT_TIMEOUT_MS }),
            objectClient: xmlrpc_1.default.createSecureClient({ url: `${cfg.odoo_url}/xmlrpc/2/object`, timeout: CONNECT_TIMEOUT_MS }),
            cachedUid: null,
            uidCachedAt: 0,
            odooMajorVersion: 0,
        };
        _cache.set(tenantId, entry);
    }
    return entry;
}
function clearOdooClientCache(tenantId) {
    if (tenantId)
        _cache.delete(tenantId);
    else
        _cache.clear();
}
// ──────────────────────────────────────────────────────────────────────────────
// Factory — returns a per-tenant client instance
// ──────────────────────────────────────────────────────────────────────────────
function getOdooClient(tenantId, cfg) {
    validateConfig(tenantId, cfg);
    const cache = getCache(tenantId, cfg);
    const { commonClient, objectClient } = cache;
    const { odoo_db, odoo_username, odoo_password } = cfg;
    const client = {
        getVersion: async () => {
            if (cache.odooMajorVersion > 0)
                return cache.odooMajorVersion;
            try {
                const info = await new Promise((resolve, reject) => commonClient.methodCall('version', [], (err, val) => (err ? reject(err) : resolve(val))));
                if (Array.isArray(info?.server_version_info)) {
                    const raw = info.server_version_info[0];
                    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
                    cache.odooMajorVersion = isNaN(parsed) ? 14 : parsed;
                }
                else {
                    cache.odooMajorVersion = 14;
                }
                console.log(`[${tenantId}] Odoo version detected: ${cache.odooMajorVersion}`);
            }
            catch {
                cache.odooMajorVersion = 14;
            }
            return cache.odooMajorVersion;
        },
        authenticate: async () => {
            const now = Date.now();
            if (cache.cachedUid && now - cache.uidCachedAt < UID_TTL_MS) {
                return cache.cachedUid;
            }
            return new Promise((resolve, reject) => {
                commonClient.methodCall('authenticate', [odoo_db, odoo_username, odoo_password, {}], (error, uid) => {
                    if (error) {
                        console.error(`[${tenantId}] Odoo Auth Error:`, error);
                        cache.cachedUid = null;
                        cache.uidCachedAt = 0;
                        cache.odooMajorVersion = 0;
                        reject(error);
                    }
                    else if (!uid) {
                        cache.cachedUid = null;
                        cache.uidCachedAt = 0;
                        cache.odooMajorVersion = 0;
                        reject(new Error('Authentication failed (uid is false)'));
                    }
                    else {
                        cache.cachedUid = uid;
                        cache.uidCachedAt = Date.now();
                        resolve(uid);
                    }
                });
            });
        },
        searchEmployee: async (uid, employeeId, pin) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [
                    odoo_db, uid, odoo_password,
                    'hr.employee', 'search_read',
                    [[['barcode', '=', employeeId], ['pin', '=', pin]]],
                    { fields: ['name', 'department_id', 'job_title', 'barcode', 'work_email'] },
                ], (error, employee) => {
                    if (error) {
                        console.error(`[${tenantId}] Odoo Search Error:`, error);
                        reject(error);
                    }
                    else
                        resolve(employee);
                });
            });
        },
        testConnection: async () => {
            return new Promise((resolve, reject) => {
                commonClient.methodCall('version', [], (error, value) => {
                    if (error)
                        reject(error);
                    else
                        resolve(value);
                });
            });
        },
        getAllEmployees: async (uid) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [
                    odoo_db, uid, odoo_password,
                    'hr.employee', 'search_read',
                    [[]],
                    { fields: ['name', 'barcode', 'pin', 'department_id', 'job_title', 'work_email'], limit: 50 },
                ], (error, employees) => {
                    if (error)
                        reject(error);
                    else
                        resolve(employees);
                });
            });
        },
        getSchema: async (uid, model) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [
                    odoo_db, uid, odoo_password,
                    model, 'fields_get', [],
                    { attributes: ['string', 'help', 'type', 'required', 'selection', 'relation'] }
                ], (error, fields) => {
                    if (error)
                        reject(error);
                    else
                        resolve(fields);
                });
            });
        },
        createRecord: async (uid, model, data) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [odoo_db, uid, odoo_password, model, 'create', [data]], (error, newId) => {
                    if (error) {
                        console.error(`[${tenantId}] Create Error (${model}):`, error);
                        reject(error);
                    }
                    else
                        resolve(newId);
                });
            });
        },
        searchRead: async (uid, model, domain, fields, silent = false) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [odoo_db, uid, odoo_password, model, 'search_read', [domain], { fields }], (error, records) => {
                    if (error) {
                        if (!silent)
                            console.error(`[${tenantId}] SearchRead Error (${model}):`, error);
                        reject(error);
                    }
                    else
                        resolve(records);
                });
            });
        },
        callMethod: async (uid, model, method, recordIds, args = {}) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [odoo_db, uid, odoo_password, model, method, [recordIds], args], (error, result) => {
                    if (error) {
                        console.error(`[${tenantId}] CallMethod Error (${model}.${method}):`, error);
                        reject(error);
                    }
                    else
                        resolve(result);
                });
            });
        },
        writeRecord: async (uid, model, recordIds, data) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [odoo_db, uid, odoo_password, model, 'write', [recordIds, data]], (error, result) => {
                    if (error) {
                        console.error(`[${tenantId}] Write Error (${model}):`, error);
                        reject(error);
                    }
                    else
                        resolve(result);
                });
            });
        },
        createAttachment: async (uid, name, datas, res_model, res_id, mimetype = 'image/jpeg') => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall('execute_kw', [
                    odoo_db, uid, odoo_password,
                    'ir.attachment', 'create',
                    [{ name, datas, res_model, res_id, mimetype, type: 'binary' }]
                ], (error, attachmentId) => {
                    if (error) {
                        console.error(`[${tenantId}] Create Attachment Error:`, error);
                        reject(error);
                    }
                    else
                        resolve(attachmentId);
                });
            });
        },
        uploadAttachments: async (uid, attachments, res_model, res_id) => {
            for (const att of attachments) {
                try {
                    await client.createAttachment(uid, att.name, att.data, res_model, res_id, att.mimetype);
                }
                catch (e) {
                    console.error(`[${tenantId}] Attachment upload failed (${att.name}):`, e);
                }
            }
        },
    };
    return client;
}
