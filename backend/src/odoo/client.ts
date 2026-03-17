import xmlrpc from 'xmlrpc';
import { config } from '../config';

const commonClient = xmlrpc.createSecureClient({
    url: `${config.odoo.url}/xmlrpc/2/common`,
});

const objectClient = xmlrpc.createSecureClient({
    url: `${config.odoo.url}/xmlrpc/2/object`,
});

// ──────────────────────────────────────────────────────────────────────────────
// Odoo Version Cache — detected once at runtime, reused everywhere
// ──────────────────────────────────────────────────────────────────────────────
let _odooMajorVersion: number = 0;

// ──────────────────────────────────────────────────────────────────────────────
// Odoo Admin UID Cache — avoid a fresh XML-RPC authenticate call on every request
// ──────────────────────────────────────────────────────────────────────────────
let _cachedUid: number | null = null;
let _uidCachedAt: number = 0;
const UID_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Returns the Odoo major version integer (e.g. 14, 16, 17). Cached after first call. */
export const getOdooVersion = async (): Promise<number> => {
    if (_odooMajorVersion > 0) return _odooMajorVersion;
    try {
        const info: any = await new Promise((resolve, reject) =>
            commonClient.methodCall('version', [], (err, val) => (err ? reject(err) : resolve(val)))
        );
        // server_version_info[0] can be an integer (14, 16, 17) or a SaaS
        // version string like "saas~19". Extract the numeric part either way.
        if (Array.isArray(info?.server_version_info)) {
            const raw = info.server_version_info[0];
            const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
            _odooMajorVersion = isNaN(parsed) ? 14 : parsed;
        } else {
            _odooMajorVersion = 14; // safe fallback
        }
        console.log(`Odoo version detected: ${_odooMajorVersion}`);
    } catch {
        _odooMajorVersion = 14; // fallback — assume v14 compatible
    }
    return _odooMajorVersion;
};

export const odooClient = {
    authenticate: async (): Promise<number> => {
        const now = Date.now();
        if (_cachedUid && now - _uidCachedAt < UID_TTL_MS) {
            return _cachedUid;
        }
        return new Promise((resolve, reject) => {
            commonClient.methodCall(
                'authenticate',
                [config.odoo.db, config.odoo.username, config.odoo.password, {}],
                (error, uid) => {
                    if (error) {
                        console.error('Odoo Auth Error:', error);
                        reject(error);
                    } else if (!uid) {
                        reject(new Error('Authentication failed (uid is false)'));
                    } else {
                        _cachedUid = uid as number;
                        _uidCachedAt = Date.now();
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
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    'hr.employee',
                    'search_read',
                    [[['barcode', '=', employeeId], ['pin', '=', pin]]],
                    { fields: ['name', 'department_id', 'job_title', 'barcode', 'work_email'] },
                ],
                (error, employee) => {
                    if (error) {
                        console.error('Odoo Search Error:', error);
                        reject(error);
                    } else {
                        resolve(employee);
                    }
                }
            );
        });
    },

    testConnection: async () => {
        return new Promise((resolve, reject) => {
            commonClient.methodCall('version', [], (error, value) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(value);
                }
            });
        });
    },

    getAllEmployees: async (uid: number) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    'hr.employee',
                    'search_read',
                    [[]], // Empty domain = all records
                    {
                        fields: ['name', 'barcode', 'pin', 'department_id', 'job_title', 'work_email'],
                        limit: 50
                    },
                ],
                (error, employees) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(employees);
                    }
                }
            );
        });
    },

    getSchema: async (uid: number, model: string) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    model,
                    'fields_get',
                    [],
                    { attributes: ['string', 'help', 'type', 'required', 'selection', 'relation'] }
                ],
                (error, fields) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(fields);
                    }
                }
            );
        });
    },

    createRecord: async (uid: number, model: string, data: any) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    model,
                    'create',
                    [data]
                ],
                (error, newId) => {
                    if (error) {
                        console.error(`Create Error (${model}):`, error);
                        reject(error);
                    } else {
                        resolve(newId);
                    }
                }
            );
        });
    },

    searchRead: async (uid: number, model: string, domain: any[], fields: string[], silent = false) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    model,
                    'search_read',
                    [domain],
                    { fields: fields }
                ],
                (error, records) => {
                    if (error) {
                        // silent=true suppresses noise for expected failures (e.g. module not installed)
                        if (!silent) console.error(`SearchRead Error (${model}):`, error);
                        reject(error);
                    } else {
                        resolve(records);
                    }
                }
            );
        });
    },

    callMethod: async (uid: number, model: string, method: string, recordIds: number[], args: any = {}) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    model,
                    method,
                    [recordIds],
                    args
                ],
                (error, result) => {
                    if (error) {
                        console.error(`CallMethod Error (${model}.${method}):`, error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    },

    /** Write (update) fields on existing record(s). Mirrors the Odoo 'write' ORM method. */
    writeRecord: async (uid: number, model: string, recordIds: number[], data: Record<string, any>) => {
        return new Promise<boolean>((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    model,
                    'write',
                    [recordIds, data],
                ],
                (error, result) => {
                    if (error) {
                        console.error(`Write Error (${model}):`, error);
                        reject(error);
                    } else {
                        resolve(result as boolean);
                    }
                }
            );
        });
    },

    /** Bulk-upload attachments to an Odoo record. Skips silently on individual errors. */
    uploadAttachments: async (
        uid: number,
        attachments: Array<{ name: string; data: string; mimetype: string }>,
        res_model: string,
        res_id: number
    ) => {
        for (const att of attachments) {
            try {
                await odooClient.createAttachment(uid, att.name, att.data, res_model, res_id, att.mimetype);
            } catch (e) {
                console.error(`Attachment upload failed (${att.name}):`, e);
            }
        }
    },

    createAttachment: async (uid: number, name: string, datas: string, res_model: string, res_id: number, mimetype: string = 'image/jpeg') => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    'ir.attachment',
                    'create',
                    [{
                        name: name,
                        datas: datas,
                        res_model: res_model,
                        res_id: res_id,
                        mimetype: mimetype,
                        type: 'binary'
                    }]
                ],
                (error, attachmentId) => {
                    if (error) {
                        console.error('Create Attachment Error:', error);
                        reject(error);
                    } else {
                        resolve(attachmentId);
                    }
                }
            );
        });
    },
};
