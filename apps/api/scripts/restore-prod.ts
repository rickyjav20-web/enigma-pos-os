
import fs from 'fs';
import https from 'https';
import path from 'path';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1/ingest/products';
const CSV_PATH = '/Users/rickyjav/Desktop/Enigma_OS_V2/Loyverse_Ajuste_Enigma_Cafe/CSV_EDITADO/export_items_ESTANDARIZADO.csv';

async function restore() {
    console.log("🚀 Starting Data Restoration to PRODUCTION...");

    try {
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error(`CSV file not found at ${CSV_PATH}`);
        }

        const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
        console.log(`✅ Loaded CSV: ${csvContent.length} bytes`);

        const payload = JSON.stringify({
            tenant_id: 'enigma_hq',
            csv_content: csvContent
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': 'enigma_hq',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(API_URL, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("✅ Restoration Successful!");
                    console.log("Response:", data);
                } else {
                    console.error(`❌ Restoration Failed with Status ${res.statusCode}`);
                    console.error("Response:", data);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Request Error: ${e.message}`);
        });

        req.write(payload);
        req.end();

    } catch (e: any) {
        console.error("❌ Script Error:", e.message);
    }
}

restore();
