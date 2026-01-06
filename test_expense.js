const http = require('http');

// Test create expense with correct format
const expenseData = JSON.stringify({
    employee_id: 7,
    product_id: 53,
    price_unit: 25.50,  // This is the correct field name
    quantity: 1,
    date: '2026-02-05',
    name: 'Team Lunch - Feb 5',
    // Optional: Add a small test receipt image (1x1 red pixel PNG in base64)
    receipt: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
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
