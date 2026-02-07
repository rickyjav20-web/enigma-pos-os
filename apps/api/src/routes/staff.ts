import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { tenantMiddleware } from '../middleware/tenant';

export default async function staffRoutes(fastify: FastifyInstance) {
    // Register Tenant Middleware for all routes in this context
    fastify.addHook('preHandler', tenantMiddleware);

    // 1. Verify PIN
    fastify.post('/auth/verify-pin', async (request, reply) => {
        const schema = z.object({
            pin: z.string().length(4),
        });

        try {
            console.log(`[AUTH-DEBUG] verifying pin: ${(request.body as any)?.pin} for tenant: ${request.tenantId}`);
            const { pin } = schema.parse(request.body);

            const employee = await prisma.employee.findFirst({
                where: {
                    tenantId: request.tenantId,
                    pinCode: pin,
                    status: 'active',
                },
            });

            console.log(`[AUTH-DEBUG] Employee found? ${!!employee} (ID: ${employee?.id})`);

            if (!employee) {
                return reply.status(401).send({ error: 'Invalid PIN' });
            }

            // Check for active shift
            const activeShift = await prisma.shift.findFirst({
                where: {
                    employeeId: employee.id,
                    clockOut: null
                }
            });

            return { employee, activeShift };
        } catch (error) {
            console.error("[AUTH-DEBUG] Error:", error);
            fastify.log.error(error);
            return reply.status(400).send({ error: 'Invalid request' });
        }
    });

    // 2. Clock In
    fastify.post('/shifts/clock-in', async (request, reply) => {
        const schema = z.object({
            employeeId: z.string(),
            mood: z.string().nullable().optional(),
            photoUrl: z.string().nullable().optional(),
            timestamp: z.string().optional(),
        });

        try {
            const { employeeId, mood, photoUrl, timestamp } = schema.parse(request.body);

            const openShift = await prisma.shift.findFirst({
                where: {
                    employeeId,
                    clockOut: null
                }
            });

            if (openShift) {
                return reply.status(400).send({ error: 'Already clocked in' });
            }

            const shift = await prisma.shift.create({
                data: {
                    tenantId: request.tenantId,
                    employeeId,
                    mood,
                    photoUrl,
                    clockIn: timestamp ? new Date(timestamp) : new Date(),
                },
            });

            return { shift };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 3. Clock Out
    fastify.post('/shifts/clock-out', async (request, reply) => {
        const schema = z.object({
            employeeId: z.string(),
            timestamp: z.string().optional(),
            exitMood: z.string().nullable().optional(),
            comments: z.string().nullable().optional(),
        });

        try {
            const { employeeId, timestamp, exitMood, comments } = schema.parse(request.body);

            const shift = await prisma.shift.findFirst({
                where: {
                    employeeId,
                    clockOut: null,
                },
            });

            if (!shift) {
                return reply.status(400).send({ error: 'No active shift found' });
            }

            const updatedShift = await prisma.shift.update({
                where: { id: shift.id },
                data: {
                    clockOut: timestamp ? new Date(timestamp) : new Date(),
                    exitMood,
                    comments
                },
            });

            return { shift: updatedShift };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 3.5 Get Shift History
    fastify.get('/shifts/history', async (request, reply) => {
        try {
            console.log(`[API-DEBUG] Fetching history for tenant: ${request.tenantId}`);
            const history = await prisma.shift.findMany({
                where: {
                    tenantId: request.tenantId,
                    clockOut: { not: null }
                },
                include: {
                    employee: true
                },
                orderBy: {
                    clockIn: 'desc'
                },
                take: 50 // Limit for now
            });
            console.log(`[API-DEBUG] Found ${history.length} historical shifts.`);
            return { shifts: history };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 4. Get Active Shifts
    fastify.get('/shifts/active', async (request, reply) => {
        try {
            const activeShifts = await prisma.shift.findMany({
                where: {
                    tenantId: request.tenantId,
                    clockOut: null,
                },
                include: {
                    employee: true,
                },
            });
            return { shifts: activeShifts };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 5. Get Employees
    fastify.get('/employees', async (request, reply) => {
        try {
            const employees = await prisma.employee.findMany({
                where: { tenantId: request.tenantId },
            });
            return { employees };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 6. Create Employee
    fastify.post('/employees', async (request, reply) => {
        const schema = z.object({
            fullName: z.string().min(1, "Full name is required"),
            role: z.string(),
            pinCode: z.string().optional(),
            email: z.string().optional().nullable().or(z.literal('')),
            phone: z.string().optional().nullable().or(z.literal('')),
            address: z.string().optional().nullable().or(z.literal('')),
            birthDate: z.string().optional().nullable().or(z.literal('')),
            startDate: z.string().optional().nullable().or(z.literal('')),
            emergencyContact: z.string().optional().nullable().or(z.literal('')),
            emergencyPhone: z.string().optional().nullable().or(z.literal('')),
            notes: z.string().optional().nullable().or(z.literal('')),
            salaryType: z.string().optional().nullable(),
            salaryAmount: z.coerce.number().optional().nullable(),
            currency: z.string().optional().nullable(),
            paymentMethod: z.string().optional().nullable(),
            bankName: z.string().optional().nullable(),
            accountNumber: z.string().optional().nullable(),
            accountHolder: z.string().optional().nullable(),
        });

        try {
            const data = schema.parse(request.body);
            const finalPin = data.pinCode || Math.floor(1000 + Math.random() * 9000).toString();

            const prepareDate = (d: string | null | undefined) => d ? new Date(d) : null;

            const employee = await prisma.employee.create({
                data: {
                    tenantId: request.tenantId,
                    fullName: data.fullName,
                    role: data.role,
                    pinCode: finalPin,
                    status: 'active',
                    email: data.email || null,
                    phone: data.phone || null,
                    address: data.address || null,
                    birthDate: prepareDate(data.birthDate),
                    startDate: prepareDate(data.startDate),
                    emergencyContact: data.emergencyContact || null,
                    emergencyPhone: data.emergencyPhone || null,
                    notes: data.notes || null,
                    salaryType: data.salaryType || 'fixed',
                    salaryAmount: data.salaryAmount || 0,
                    currency: data.currency || 'USD',
                    paymentMethod: data.paymentMethod || 'transfer',
                    bankName: data.bankName || null,
                    accountNumber: data.accountNumber || null,
                    accountHolder: data.accountHolder || null
                }
            });

            return { employee };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error', details: error.message });
        }
    });

    // 6.5 Update Employee
    fastify.patch<{ Params: { id: string } }>('/employees/:id', async (request, reply) => {
        const { id } = request.params;

        // Zod Schema to strip unknown fields and validate types
        const updateSchema = z.object({
            fullName: z.string().optional(),
            role: z.string().optional(),
            pinCode: z.string().optional(),
            status: z.string().optional(),
            email: z.string().optional().nullable().or(z.literal('')),
            phone: z.string().optional().nullable().or(z.literal('')),
            address: z.string().optional().nullable().or(z.literal('')),
            birthDate: z.string().optional().nullable().or(z.literal('')),
            startDate: z.string().optional().nullable().or(z.literal('')),
            emergencyContact: z.string().optional().nullable().or(z.literal('')),
            emergencyPhone: z.string().optional().nullable().or(z.literal('')),
            notes: z.string().optional().nullable().or(z.literal('')),
            salaryType: z.string().optional().nullable(),
            salaryAmount: z.coerce.number().optional().nullable(),
            currency: z.string().optional().nullable(),
            paymentMethod: z.string().optional().nullable(),
            bankName: z.string().optional().nullable(),
            accountNumber: z.string().optional().nullable(),
            accountHolder: z.string().optional().nullable(),
        });

        try {
            // Parse and strip unknown (like 'shifts', 'recurring', etc.)
            const data = updateSchema.parse(request.body);

            const prepareDate = (d: string | null | undefined) => d ? new Date(d) : (d === '' ? null : undefined);

            const updateData: any = {
                ...data,
                // Handle Dates specifically if they are present
                birthDate: data.birthDate !== undefined ? (data.birthDate ? new Date(data.birthDate) : null) : undefined,
                startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
            };

            // Remove undefined keys to avoid overriding with undefined
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const employee = await prisma.employee.update({
                where: { id, tenantId: request.tenantId },
                data: updateData
            });
            return { employee };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error', details: error.message });
        }
    });


    // 7. Schedules (Basic)
    fastify.get('/schedules', async (request, reply) => {
        try {
            const query = request.query as any;
            const schedules = await prisma.schedule.findMany({
                where: {
                    tenantId: request.tenantId,
                    startTime: { gte: new Date(query.start) },
                    endTime: { lte: new Date(query.end) }
                },
                include: { employee: true }
            });
            return { schedules };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 7.1 Create Schedule
    fastify.post('/schedules', async (request, reply) => {
        const schema = z.object({
            employeeId: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            note: z.string().optional()
        });
        try {
            const data = schema.parse(request.body);
            const schedule = await prisma.schedule.create({
                data: {
                    tenantId: request.tenantId,
                    employeeId: data.employeeId,
                    startTime: new Date(data.startTime),
                    endTime: new Date(data.endTime),
                    note: data.note
                }
            });
            return { schedule };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 7.2 Delete Schedule
    fastify.delete<{ Params: { id: string } }>('/schedules/:id', async (request, reply) => {
        try {
            await prisma.schedule.delete({
                where: { id: request.params.id, tenantId: request.tenantId }
            });
            return { success: true };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 7.3 Autofill Schedules
    fastify.post('/schedules/autofill', async (request, reply) => {
        const schema = z.object({
            start: z.string(), // ISO
            end: z.string()   // ISO
        });

        try {
            const { start, end } = schema.parse(request.body);
            const startDate = new Date(start);
            const endDate = new Date(end);

            // Get all active employees with recurring patterns
            const employees = await prisma.employee.findMany({
                where: { tenantId: request.tenantId, status: 'active' },
                include: { recurring: true }
            });

            const newSchedules = [];

            // Iterate days
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay(); // 0 = Sun

                for (const emp of employees) {
                    const pattern = emp.recurring.find(r => r.dayOfWeek === dayOfWeek && r.isActive);
                    if (pattern) {
                        const [sh, sm] = pattern.startTime.split(':').map(Number);
                        const [eh, em] = pattern.endTime.split(':').map(Number);

                        const sTime = new Date(d);
                        sTime.setHours(sh, sm, 0);

                        const eTime = new Date(d);
                        eTime.setHours(eh, em, 0);

                        // Basic overlap check could go here, but for MVP skipping
                        newSchedules.push({
                            tenantId: request.tenantId,
                            employeeId: emp.id,
                            startTime: sTime,
                            endTime: eTime
                        });
                    }
                }
            }

            if (newSchedules.length > 0) {
                await prisma.schedule.createMany({
                    data: newSchedules
                });
            }

            return { created: newSchedules.length };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 8. Recurring Schedules
    fastify.get<{ Params: { employeeId: string } }>('/recurring/:employeeId', async (request, reply) => {
        try {
            const recurring = await prisma.recurringSchedule.findMany({
                where: { tenantId: request.tenantId, employeeId: request.params.employeeId }
            });
            return { recurring };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    fastify.post('/recurring', async (request, reply) => {
        const schema = z.object({
            employeeId: z.string(),
            patterns: z.array(z.object({
                dayOfWeek: z.number().min(0).max(6),
                startTime: z.string(),
                endTime: z.string(),
                isActive: z.boolean()
            }))
        });

        try {
            const { employeeId, patterns } = schema.parse(request.body);

            // Transaction: Delete existing for this employee & create new
            // Or upsert. Let's delete & create for simplicity or upsert one by one.
            // Upsert is safer for ID preservation but we reset usually.
            // Using transaction for atomic update.
            await prisma.$transaction(async (tx) => {
                for (const p of patterns) {
                    const existing = await tx.recurringSchedule.findFirst({
                        where: { tenantId: request.tenantId, employeeId, dayOfWeek: p.dayOfWeek }
                    });

                    if (existing) {
                        await tx.recurringSchedule.update({
                            where: { id: existing.id },
                            data: {
                                startTime: p.startTime,
                                endTime: p.endTime,
                                isActive: p.isActive
                            }
                        });
                    } else {
                        await tx.recurringSchedule.create({
                            data: {
                                tenantId: request.tenantId,
                                employeeId,
                                dayOfWeek: p.dayOfWeek,
                                startTime: p.startTime,
                                endTime: p.endTime,
                                isActive: p.isActive
                            }
                        });
                    }
                }
            });

            return { success: true };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    // 9. Documents
    fastify.get<{ Params: { employeeId: string } }>('/employees/:employeeId/documents', async (request, reply) => {
        try {
            const docs = await prisma.document.findMany({
                where: { tenantId: request.tenantId, employeeId: request.params.employeeId },
                orderBy: { uploadedAt: 'desc' }
            });
            return docs;
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });

    fastify.post<{ Params: { employeeId: string } }>('/employees/:employeeId/documents', async (request, reply) => {
        // For MVP, we might store Base64 directly in URL field or separate table.
        // The schema has `url: String` (Text).
        // WARNING: Storing base64 in DB is bad practice for large files, but allowed for MVP text only.
        // We'll limit size in body usually.
        const schema = z.object({
            title: z.string(),
            type: z.string(),
            fileName: z.string(),
            fileData: z.string() // Base64
        });

        try {
            const { title, type, fileName, fileData } = schema.parse(request.body);
            // In real app, upload to S3 here.
            // Mock: Just save as data URI if it's small enough, or pretend.
            // The user wants it "Functional".
            // We'll save the Base64 string in `url` field if it fits? Text can hold larger data.
            // Postgres TEXT is usually 1GB limit. It's fine for small docs (<10MB).

            const doc = await prisma.document.create({
                data: {
                    tenantId: request.tenantId,
                    employeeId: request.params.employeeId,
                    title,
                    type,
                    url: fileData // Storing content directly
                }
            });

            return doc;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Upload failed' });
        }
    });

    // 10. Delete Employee (Soft)
    fastify.delete<{ Params: { id: string } }>('/employees/:id', async (request, reply) => {
        try {
            await prisma.employee.update({
                where: { id: request.params.id, tenantId: request.tenantId },
                data: { status: 'inactive' }
            });
            return { success: true };
        } catch (error) {
            return reply.status(500).send({ error: 'Server error' });
        }
    });
}
