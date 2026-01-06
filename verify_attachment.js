const path = require('path');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env') });
const { odooClient } = require('./backend/dist/odoo/client');
const { config } = require('./backend/dist/config');

async function main() {
    try {
        console.log('Authenticating...');
        const uid = await odooClient.authenticate();
        console.log('Authenticated with UID:', uid);

        const expenseId = 23; // Check the latest expense

        // Check Expense
        console.log(`Checking Expense ${expenseId}...`);
        const expenses = await odooClient.searchRead(
            uid,
            'hr.expense',
            [['id', '=', expenseId]],
            ['id', 'name', 'state', 'price_unit', 'total_amount', 'quantity']
        );
        console.log('Expense:', expenses[0]);

        // Check Attachment
        console.log(`Checking Attachments for Expense ${expenseId}...`);
        const attachments = await odooClient.searchRead(
            uid,
            'ir.attachment',
            [['res_model', '=', 'hr.expense'], ['res_id', '=', expenseId]],
            ['id', 'name', 'mimetype', 'file_size']
        );
        console.log('Attachments:', attachments);

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
