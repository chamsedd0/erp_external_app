"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.odooClient = void 0;
const xmlrpc_1 = __importDefault(require("xmlrpc"));
const config_1 = require("../config");
const commonClient = xmlrpc_1.default.createSecureClient({
    url: `${config_1.config.odoo.url}/xmlrpc/2/common`,
});
const objectClient = xmlrpc_1.default.createSecureClient({
    url: `${config_1.config.odoo.url}/xmlrpc/2/object`,
});
exports.odooClient = {
    authenticate: async () => {
        return new Promise((resolve, reject) => {
            commonClient.methodCall('authenticate', [config_1.config.odoo.db, config_1.config.odoo.username, config_1.config.odoo.password, {}], (error, uid) => {
                if (error) {
                    console.error('Odoo Auth Error:', error);
                    reject(error);
                }
                else if (!uid) {
                    reject(new Error('Authentication failed (uid is false)'));
                }
                else {
                    resolve(uid);
                }
            });
        });
    },
    searchEmployee: async (uid, employeeId, pin) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                'hr.employee',
                'search_read',
                [[['barcode', '=', employeeId], ['pin', '=', pin]]],
                { fields: ['name', 'department_id', 'job_title', 'barcode', 'work_email'] },
            ], (error, employee) => {
                if (error) {
                    console.error('Odoo Search Error:', error);
                    reject(error);
                }
                else {
                    resolve(employee);
                }
            });
        });
    },
    testConnection: async () => {
        return new Promise((resolve, reject) => {
            commonClient.methodCall('version', [], (error, value) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(value);
                }
            });
        });
    },
    getAllEmployees: async (uid) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                'hr.employee',
                'search_read',
                [[]], // Empty domain = all records
                {
                    fields: ['name', 'barcode', 'pin', 'department_id', 'job_title', 'work_email'],
                    limit: 50
                },
            ], (error, employees) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(employees);
                }
            });
        });
    },
    getSchema: async (uid, model) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                model,
                'fields_get',
                [],
                { attributes: ['string', 'help', 'type', 'required', 'selection'] }
            ], (error, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(fields);
                }
            });
        });
    },
    createRecord: async (uid, model, data) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                model,
                'create',
                [data]
            ], (error, newId) => {
                if (error) {
                    console.error(`Create Error (${model}):`, error);
                    reject(error);
                }
                else {
                    resolve(newId);
                }
            });
        });
    },
    searchRead: async (uid, model, domain, fields) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                model,
                'search_read',
                [domain],
                { fields: fields }
            ], (error, records) => {
                if (error) {
                    console.error(`SearchRead Error (${model}):`, error);
                    reject(error);
                }
                else {
                    resolve(records);
                }
            });
        });
    },
    callMethod: async (uid, model, method, recordIds, args = {}) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                model,
                method,
                [recordIds],
                args
            ], (error, result) => {
                if (error) {
                    console.error(`CallMethod Error (${model}.${method}):`, error);
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
        });
    },
    createAttachment: async (uid, name, datas, res_model, res_id, mimetype = 'image/jpeg') => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
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
            ], (error, attachmentId) => {
                if (error) {
                    console.error('Create Attachment Error:', error);
                    reject(error);
                }
                else {
                    resolve(attachmentId);
                }
            });
        });
    },
};
