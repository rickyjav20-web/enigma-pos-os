
import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';

import fs from 'fs';
import path from 'path';

export default async function maintenanceRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: { secret: string; schema?: string } }>('/system/maintenance/migrate', async (request, reply) => {
        const { secret, schema } = request.body;

        if (secret !== 'enigma-db-force-migrate') {
            return reply.status(403).send({ error: "Unauthorized" });
        }

        console.log("⚠️ Starting Emergency Migration from API...");

        let command = 'npx prisma db push';

        // If schema is provided, write to temp file
        if (schema) {
            const tempSchemaPath = path.join('/tmp', 'schema.prisma');
            fs.writeFileSync(tempSchemaPath, schema);
            console.log(`[Maintenance] Schema written to ${tempSchemaPath}`);
            command = `npx prisma db push --schema ${tempSchemaPath}`;
        }

        return new Promise((resolve, reject) => {
            exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Migration Error: ${error.message}`);
                    return reply.status(500).send({
                        success: false,
                        error: error.message,
                        command,
                        stderr
                    });
                }

                console.log(`Migration Output: ${stdout}`);
                reply.send({
                    success: true,
                    message: "Migration completed successfully",
                    command,
                    output: stdout
                });
                resolve(true);
            });
        });
    });
}
