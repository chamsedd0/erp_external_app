const http = require('http');

function postRequest(path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Response from ${path}:`, res.statusCode, body);
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with request to ${path}:`, e.message);
            resolve();
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    // Test Time Off
    await postRequest('/time-off', JSON.stringify({
        employee_id: 7,
        holiday_status_id: 1,
        date_from: '2026-02-01T09:00:00',
        date_to: '2026-02-02T18:00:00',
        name: 'Test Leave from Node Script'
    }));

    // Test Expense (FIXED: unit_amount -> price_unit)
    await postRequest('/expenses', JSON.stringify({
        employee_id: 7,
        product_id: 53,
        price_unit: 15.5,
        date: '2026-02-01',
        name: 'Test Lunch Script'
    }));
}

main();
