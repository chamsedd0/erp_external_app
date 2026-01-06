const path = require('path');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env') });
const { odooClient } = require('./backend/dist/odoo/client');
const { config } = require('./backend/dist/config');

async function main() {
    try {
        console.log('Authenticating...');
        const uid = await odooClient.authenticate();
        console.log('Authenticated with UID:', uid);

        // Fetch View Architecture for hr.expense
        console.log('Fetching hr.expense form view...');
        // We need to use fields_view_get or similar. Our client doesn't have it explicitly, 
        // but we can use callMethod or create a generic cleaner call.
        // wait, we added callMethod, but fields_view_get is usually called on the model.

        // Let's use specific xmlrpc call if needed, or better, the generic method.
        // fields_view_get(view_id=None, view_type='form', toolbar=False, submenu=False)

        // Note: callMethod calls `execute_kw` with `method` and `[ids]` and `kwargs`.
        // fields_view_get is a model method, usually passed with ids=[] (or no ids if class method).
        // syntax: execute_kw(db, uid, password, model, 'fields_view_get', [], {'view_type': 'form', 'toolbar': True})

        // I need to use the `objectClient` directly or add a new helper? 
        // Let's just use the `callMethod` I added, but pass [] as ids.

        const view = await odooClient.callMethod(
            uid,
            'hr.expense',
            'fields_view_get',
            [], // No specific record needed
            { view_type: 'form', toolbar: true }
        );

        console.log('View Arch:', JSON.stringify(view, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
