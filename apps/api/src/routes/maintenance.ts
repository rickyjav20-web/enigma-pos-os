
import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';

export default async function maintenanceRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: { secret: string } }>('/system/maintenance/migrate', async (request, reply) => {
        const { secret } = request.body;

        if (secret !== 'enigma-db-force-migrate') {
            return reply.status(403).send({ error: "Unauthorized" });
        }

        console.log("⚠️ Starting Emergency Migration from API...");

        return new Promise((resolve, reject) => {
            exec('npx prisma db push', { cwd: process.cwd() }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Migration Error: ${error.message}`);
                    return reply.status(500).send({
                        success: false,
                        error: error.message,
                        stderr
                    });
                }

                console.log(`Migration Output: ${stdout}`);
                reply.send({
                    success: true,
                    message: "Migration completed successfully",
                    output: stdout
                });
                resolve(true);
            });
        });
    });
}
