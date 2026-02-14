
import { exec } from 'child_process';

const INTERVAL = 10000; // 10s
const MAX_ATTEMPTS = 30; // 5 mins

let attempts = 0;

function run() {
    attempts++;
    console.log(`Attempt ${attempts}/${MAX_ATTEMPTS}...`);

    exec('npx ts-node scripts/trigger-migration.ts', (error, stdout, stderr) => {
        if (stdout.includes('"success":true')) {
            console.log("✅ SUCCESS!");
            console.log(stdout);
            process.exit(0);
        } else if (stdout.includes('"command":')) {
            console.log("⚠️ New Code detected but migration failed!");
            console.log(stdout);
            process.exit(1);
        } else {
            console.log("⏳ Still old code (or generic failure). Retrying...");
            if (attempts >= MAX_ATTEMPTS) {
                console.error("❌ Timeout waiting for deployment.");
                process.exit(1);
            }
            setTimeout(run, INTERVAL);
        }
    });
}

run();
