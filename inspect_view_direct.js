const path = require('path');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env') });
const { config } = require('./backend/dist/config');
const xmlrpc = require('./backend/node_modules/xmlrpc');

async function main() {
    try {
        // Authenticate
        const commonClient = xmlrpc.createSecureClient({
            url: `${config.odoo.url}/xmlrpc/2/common`,
        });

        const uid = await new Promise((resolve, reject) => {
            commonClient.methodCall(
                'authenticate',
                [config.odoo.db, config.odoo.username, config.odoo.password, {}],
                (error, uid) => error ? reject(error) : resolve(uid)
            );
        });

        console.log('Authenticated with UID:', uid);

        // Call get_view directly
        const objectClient = xmlrpc.createSecureClient({
            url: `${config.odoo.url}/xmlrpc/2/object`,
        });

        const view = await new Promise((resolve, reject) => {
            objectClient.methodCall(
                'execute_kw',
                [
                    config.odoo.db,
                    uid,
                    config.odoo.password,
                    'hr.expense',
                    'get_view',
                    [null, 'form'], // args: view_id=None, view_type='form'
                    { toolbar: true } // kwargs
                ],
                (error, result) => error ? reject(error) : resolve(result)
            );
        });

        if (view && view.arch) {
            const buttonRegex = /<button[^>]*name="([^"]*)"[^>]*string="([^"]*)"/g;
            let match;
            console.log('Buttons found:');
            while ((match = buttonRegex.exec(view.arch)) !== null) {
                console.log(`- Name: ${match[1]}, String: ${match[2]}`);
            }

            // Also check for name only
            const buttonNameRegex = /<button[^>]*name="([^"]*)"/g;
            while ((match = buttonNameRegex.exec(view.arch)) !== null) {
                // simple log to catch all
            }

            console.log('\nFull Arch (Header only):');
            const headerMatch = /<header>([\s\S]*?)<\/header>/;
            if (view.arch.match(headerMatch)) {
                console.log(view.arch.match(headerMatch)[1]);
            }
        } else {
            console.log('No arch found in view result');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
