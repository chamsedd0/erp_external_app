import xmlrpc from 'xmlrpc';
import type { TenantConfig } from '../lib/tenantStore';

// ──────────────────────────────────────────────────────────────────────────────
// Per-tenant client cache
// ──────────────────────────────────────────────────────────────────────────────
interface TenantClientCache {
    fingerprint: string;
    commonClient: ReturnType<typeof xmlrpc.createSecureClient>;
    objectClient: ReturnType<typeof xmlrpc.createSecureClient>;
    cachedUid: number | null;
    uidCachedAt: number;
    odooMajorVersion: number;
}

const UID_TTL_MS = 60 * 60 * 1000; // 1 hour
const CONNECT_TIMEOUT_MS = 10_000;  // 10s — fail fast on bad URLs
const _cache = new Map<string, TenantClientCache>();

function configFingerprint(cfg: TenantConfig): string {
    return JSON.stringify({
        url: cfg.odoo_url,
        db: cfg.odoo_db,
        username: cfg.odoo_username,
        password: cfg.odoo_password,
    });
}

function validateConfig(tenantId: string, cfg: TenantConfig) {
    const missing = (['odoo_url', 'odoo_db', 'odoo_username', 'odoo_password'] as const)
        .filter(k => !cfg[k]);
    if (missing.length) {
        throw new Error(`[${tenantId}] Invalid tenant config — missing fields: ${missing.join(', ')}`);
    }
}

function getCache(tenantId: string, cfg: TenantConfig): TenantClientCache {
    const fingerprint = configFingerprint(cfg);
    let entry = _cache.get(tenantId);
    if (!entry || entry.fingerprint !== fingerprint) {
        entry = {
            fingerprint,
            commonClient: xmlrpc.createSecureClient({ url: `${cfg.odoo_url}/xmlrpc/2/common`, timeout: CONNECT_TIMEOUT_MS } as any),
            objectClient: xmlrpc.createSecureClient({ url: `${cfg.odoo_url}/xmlrpc/2/object`, timeout: CONNECT_TIMEOUT_MS } as any),
            cachedUid: null,
            uidCachedAt: 0,
            odooMajorVersion: 0,
        };
        _cache.set(tenantId, entry);
    }
    return entry;
}

export function clearOdooClientCache(tenantId?: string) {
    if (tenantId) _cache.delete(tenantId);
    else _cache.clear();
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory — returns a per-tenant client instance
// ──────────────────────────────────────────────────────────────────────────────
export function getOdooClient(tenantId: string, cfg: TenantConfig) {
    validateConfig(tenantId, cfg);
    const cache = getCache(tenantId, cfg);
    const { commonClient, objectClient } = cache;
    const { odoo_db, odoo_username, odoo_password } = cfg;

    const client = {
        getVersion: async (): Promise<number> => {
            if (cache.odooMajorVersion > 0) return cache.odooMajorVersion;
            try {
                const info: any = await new Promise((resolve, reject) =>
                    commonClient.methodCall('version', [], (err, val) => (err ? reject(err) : resolve(val)))
                );
                if (Array.isArray(info?.server_version_info)) {
                    const raw = info.server_version_info[0];
                    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
                    cache.odooMajorVersion = isNaN(parsed) ? 14 : parsed;
                } else {
                    cache.odooMajorVersion = 14;
                }
                console.log(`[${tenantId}] Odoo version detected: ${cache.odooMajorVersion}`);
            } catch {
                cache.odooMajorVersion = 14;
            }
            return cache.odooMajorVersion;
        },

        authenticate: async (): Promise<number> => {
            const now = Date.now();
            if (cache.cachedUid && now - cache.uidCachedAt < UID_TTL_MS) {
                return cache.cachedUid;
            }
            return new Promise((resolve, reject) => {
                commonClient.methodCall(
                    'authenticate',
                    [odoo_db, odoo_username, odoo_password, {}],
                    (error, uid) => {
                        if (error) {
                            console.error(`[${tenantId}] Odoo Auth Error:`, error);
                            cache.cachedUid = null;
                            cache.uidCachedAt = 0;
                            cache.odooMajorVersion = 0;
                            reject(error);
                        } else if (!uid) {
                            cache.cachedUid = null;
                            cache.uidCachedAt = 0;
                            cache.odooMajorVersion = 0;
                            reject(new Error('Authentication failed (uid is false)'));
                        } else {
                            cache.cachedUid = uid as number;
                            cache.uidCachedAt = Date.now();
                            resolve(uid as number);
                        }
                    }
                );
            });
        },

        searchEmployee: async (uid: number, employeeId: string, pin: string) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [
                        odoo_db, uid, odoo_password,
                        'hr.employee', 'search_read',
                        [[['barcode', '=', employeeId], ['pin', '=', pin]]],
                        { fields: ['name', 'department_id', 'job_title', 'barcode', 'work_email'] },
                    ],
                    (error, employee) => {
                        if (error) { console.error(`[${tenantId}] Odoo Search Error:`, error); reject(error); }
                        else resolve(employee);
                    }
                );
            });
        },

        testConnection: async () => {
            return new Promise((resolve, reject) => {
                commonClient.methodCall('version', [], (error, value) => {
                    if (error) reject(error);
                    else resolve(value);
                });
            });
        },

        getAllEmployees: async (uid: number) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [
                        odoo_db, uid, odoo_password,
                        'hr.employee', 'search_read',
                        [[]],
                        { fields: ['name', 'barcode', 'pin', 'department_id', 'job_title', 'work_email'], limit: 50 },
                    ],
                    (error, employees) => {
                        if (error) reject(error);
                        else resolve(employees);
                    }
                );
            });
        },

        getSchema: async (uid: number, model: string) => {
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [
                        odoo_db, uid, odoo_password,
                        model, 'fields_get', [],
                        { attributes: ['string', 'help', 'type', 'required', 'selection', 'relation', 'readonly', 'store'] }
                    ],
                    (error, fields) => {
                        if (error) reject(error);
                        else resolve(fields);
                    }
                );
            });
        },

        createRecord: async (uid: number, model: string, data: any, context?: Record<string, any>) => {
            const kwargs: Record<string, any> = {};
            if (context && Object.keys(context).length > 0) kwargs.context = context;
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [odoo_db, uid, odoo_password, model, 'create', [data], kwargs],
                    (error, newId) => {
                        if (error) { console.error(`[${tenantId}] Create Error (${model}):`, error); reject(error); }
                        else resolve(newId);
                    }
                );
            });
        },

        // `opts` accepts a legacy boolean (silent) for backward compat, or an options
        // object carrying an Odoo `context` (e.g. allowed_company_ids, lang).
        searchRead: async (
            uid: number,
            model: string,
            domain: any[],
            fields: string[],
            opts: boolean | { silent?: boolean; context?: Record<string, any>; limit?: number; offset?: number } = false,
        ) => {
            const { silent = false, context, limit, offset } =
                typeof opts === 'boolean' ? { silent: opts, context: undefined, limit: undefined, offset: undefined } : opts;
            const kwargs: Record<string, any> = { fields };
            if (context && Object.keys(context).length > 0) kwargs.context = context;
            if (typeof limit === 'number' && limit > 0) kwargs.limit = limit;
            if (typeof offset === 'number' && offset > 0) kwargs.offset = offset;
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [odoo_db, uid, odoo_password, model, 'search_read', [domain], kwargs],
                    (error, records) => {
                        if (error) {
                            if (!silent) console.error(`[${tenantId}] SearchRead Error (${model}):`, error);
                            reject(error);
                        } else resolve(records);
                    }
                );
            });
        },

        callMethod: async (uid: number, model: string, method: string, recordIds: number[], args: any = {}, context?: Record<string, any>) => {
            const kwargs = context && Object.keys(context).length > 0 ? { ...args, context } : args;
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [odoo_db, uid, odoo_password, model, method, [recordIds], kwargs],
                    (error, result) => {
                        if (error) { console.error(`[${tenantId}] CallMethod Error (${model}.${method}):`, error); reject(error); }
                        else resolve(result);
                    }
                );
            });
        },

        writeRecord: async (uid: number, model: string, recordIds: number[], data: Record<string, any>, context?: Record<string, any>) => {
            const kwargs: Record<string, any> = {};
            if (context && Object.keys(context).length > 0) kwargs.context = context;
            return new Promise<boolean>((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [odoo_db, uid, odoo_password, model, 'write', [recordIds, data], kwargs],
                    (error, result) => {
                        if (error) { console.error(`[${tenantId}] Write Error (${model}):`, error); reject(error); }
                        else resolve(result as boolean);
                    }
                );
            });
        },

        createAttachment: async (uid: number, name: string, datas: string, res_model: string, res_id: number, mimetype: string = 'image/jpeg', context?: Record<string, any>) => {
            const kwargs: Record<string, any> = {};
            if (context && Object.keys(context).length > 0) kwargs.context = context;
            return new Promise((resolve, reject) => {
                objectClient.methodCall(
                    'execute_kw',
                    [
                        odoo_db, uid, odoo_password,
                        'ir.attachment', 'create',
                        [{ name, datas, res_model, res_id, mimetype, type: 'binary' }],
                        kwargs,
                    ],
                    (error, attachmentId) => {
                        if (error) { console.error(`[${tenantId}] Create Attachment Error:`, error); reject(error); }
                        else resolve(attachmentId);
                    }
                );
            });
        },

        uploadAttachments: async (
            uid: number,
            attachments: Array<{ name: string; data: string; mimetype: string }>,
            res_model: string,
            res_id: number,
            context?: Record<string, any>,
        ): Promise<{ uploaded: number; failed: string[] }> => {
            const failed: string[] = [];
            let uploaded = 0;
            for (const att of attachments) {
                try {
                    await client.createAttachment(uid, att.name, att.data, res_model, res_id, att.mimetype, context);
                    uploaded++;
                } catch (e) {
                    console.error(`[${tenantId}] Attachment upload failed (${att.name}):`, e);
                    failed.push(att.name);
                }
            }
            return { uploaded, failed };
        },
    };

    return client;
}

export type OdooClientInstance = ReturnType<typeof getOdooClient>;
