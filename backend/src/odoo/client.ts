import xmlrpc from 'xmlrpc';
import { config } from '../config';

const commonClient = xmlrpc.createSecureClient({
    url: `${config.odoo.url}/xmlrpc/2/common`,
});

const objectClient = xmlrpc.createSecureClient({
    url: `${config.odoo.url}/xmlrpc/2/object`,
});

export const odooClient = {
    authenticate: async (): Promise<number> => {
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
};
