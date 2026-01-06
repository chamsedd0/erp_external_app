const http = require('http');

// Test create time-off with correct format
const leaveData = JSON.stringify({
    employee_id: 7,
    holiday_status_id: 1,
    date_from: '2026-02-10 09:00:00',
    date_to: '2026-02-11 18:00:00',
    name: 'Personal Leave - Feb 10-11'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/time-off',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(leaveData)
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

req.write(leaveData);
req.end();
