const http = require('http');

// Test create expense with correct format
const expenseData = JSON.stringify({
    employee_id: 7,
    product_id: 53,
    price_unit: 25.50,
    quantity: 1,
    date: '2026-02-05',
    name: 'Team Lunch - Feb 5'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/expenses',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(expenseData)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(expenseData);
req.end();
