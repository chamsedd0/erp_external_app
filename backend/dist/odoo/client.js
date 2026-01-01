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
    searchEmployee: async (uid, registrationNumber, pin) => {
        return new Promise((resolve, reject) => {
            objectClient.methodCall('execute_kw', [
                config_1.config.odoo.db,
                uid,
                config_1.config.odoo.password,
                'hr.employee',
                'search_read',
                [[['registration_number', '=', registrationNumber], ['x_app_password', '=', pin]]],
                { fields: ['name', 'department_id', 'job_title'] },
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
};
