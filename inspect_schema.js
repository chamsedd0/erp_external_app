
const http = require('http');

function fetchSchema(model) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000/auth/schema/${model}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error || !json.schema) {
                        console.log(`Error or no schema for ${model}:`, json);
                        resolve([]);
                        return;
                    }
                    const required = Object.entries(json.schema)
                        .filter(([k, v]) => v.required)
                        .map(([k, v]) => k);
                    console.log(`Required fields for ${model}:`, required);
                    resolve(required);
                } catch (e) {
                    console.error(`Failed to parse ${model}:`, e);
                    resolve([]);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    await fetchSchema('hr.leave');
    await fetchSchema('hr.expense');
}

main();
