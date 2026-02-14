import https from 'https';
import fs from 'fs';
import path from 'path';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1/system/maintenance/migrate';
const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

async function trigger() {
    console.log("⚠️ Triggering Remote Schema Migration with Schema Upload...");

    if (!fs.existsSync(SCHEMA_PATH)) {
        console.error(`❌ Schema file not found at ${SCHEMA_PATH}`);
        process.exit(1);
    }

    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    console.log(`✅ Loaded Schema: ${schemaContent.length} bytes`);

    const payload = JSON.stringify({
        secret: 'enigma-db-force-migrate',
        schema: schemaContent
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(API_URL, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log("Response:", data);
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Request Error: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

trigger();
