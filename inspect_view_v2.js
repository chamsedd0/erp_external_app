const path = require('path');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env') });
const { odooClient } = require('./backend/dist/odoo/client');
const { config } = require('./backend/dist/config');

async function main() {
    try {
        console.log('Authenticating...');
        const uid = await odooClient.authenticate();
        console.log('Authenticated with UID:', uid);

        // Try get_view (Odoo 16+ / 19)
        // def get_view(self, view_id=None, view_type='form', **options):
        console.log('Calling get_view...');
        const result = await odooClient.callMethod(
            uid,
            'hr.expense',
            'get_view',
            [], // ids (empty list as it's a model method usually, but let's see)
            { view_type: 'form' } // kwargs
        );

        // Result is likely { arch: "..." , ... } or [arch, view] depending on version
        console.log('View Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('get_view Error:', error);

        // Fallback: search for buttons in ir.ui.view records?
        // No, that's too hard to parse.
    }
}

main();
