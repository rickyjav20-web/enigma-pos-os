// Force Restart 2026-01-29
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // For base64 photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DEBUG LOGGING TO FILE
const logFile = path.join(__dirname, 'server_debug.log');

app.use((req, res, next) => {
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url} | Tenant: ${req.headers['x-tenant-id']} | Body keys: ${Object.keys(req.body).join(',')}`;
    // fs.appendFileSync(logFile, log + '\n');
    console.log(log.trim());
    next();
});

// Middleware to extract Tenant ID
// Middleware to extract Tenant ID
const tenantMiddleware = async (req, res, next) => {
    const tenantHeader = req.headers['x-tenant-id'];

    try {
        let tenant;

        // 1. Try to find by ID or Slug if header present
        if (tenantHeader) {
            tenant = await prisma.tenant.findFirst({
                where: {
                    OR: [
                        { id: tenantHeader },
                        { slug: tenantHeader }
                    ]
                }
            });
        }

        // 2. Fallback to default "Enigma Café" if nothing found
        if (!tenant) {
            console.log(`[MIDDLEWARE] Tenant not found for '${tenantHeader}', trying default...`);
            tenant = await prisma.tenant.findUnique({
                where: { slug: 'enigma-cafe' }
            });
        }

        if (tenant) {
            console.log(`[MIDDLEWARE] Resolved Tenant: ${tenant.name} (${tenant.id})`);
            req.tenantId = tenant.id;
            return next();
        }

        console.log(`[MIDDLEWARE] ERROR: Tenant Not Found`);
        return res.status(400).json({ error: 'Tenant context required' });

    } catch (e) {
        console.error("Tenant Middleware Error", e);
        return res.status(500).json({ error: 'Server Error' });
    }
};

// --- ROUTES ---

// 1. Verify PIN
app.post('/auth/verify-pin', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        pin: z.string().length(4),
    });

    try {
        const { pin } = schema.parse(req.body);

        const employee = await prisma.employee.findFirst({
            where: {
                tenantId: req.tenantId,
                pinCode: pin,
                status: 'active',
            },
        });

        if (!employee) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Check for active shift
        const activeShift = await prisma.shift.findFirst({
            where: {
                employeeId: employee.id,
                clockOut: null
            }
        });

        res.json({ employee, activeShift });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid request' });
    }
});

// 2. Clock In
app.post('/shifts/clock-in', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        mood: z.string().nullable().optional(),
        photoUrl: z.string().nullable().optional(), // Base64
        timestamp: z.string().optional(), // For sync from offline
    });

    try {
        const { employeeId, mood, photoUrl, timestamp } = schema.parse(req.body);

        // Check if already clocked in? 
        // Simplified: Just create a new shift record.
        // In a real app we'd check for open shifts.

        const openShift = await prisma.shift.findFirst({
            where: {
                employeeId,
                clockOut: null
            }
        });

        if (openShift) {
            return res.status(400).json({ error: 'Already clocked in' });
        }

        const shift = await prisma.shift.create({
            data: {
                tenantId: req.tenantId,
                employeeId,
                mood,
                photoUrl,
                clockIn: timestamp ? new Date(timestamp) : new Date(),
            },
        });

        const successLog = `[${new Date().toISOString()}] SUCCESS Clock-In: Shift ${shift.id}\n`;
        // fs.appendFileSync(logFile, successLog);

        res.json({ shift });
    } catch (error) {
        const errorLog = `[${new Date().toISOString()}] ERROR Clock-In: ${error.message}\n${error.stack}\n`;
        // fs.appendFileSync(logFile, errorLog);
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Clock Out
app.post('/shifts/clock-out', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        timestamp: z.string().optional(),
        exitMood: z.string().nullable().optional(),
        comments: z.string().nullable().optional(),
    });

    try {
        const { employeeId, timestamp, exitMood, comments } = schema.parse(req.body);

        // Find active shift
        const shift = await prisma.shift.findFirst({
            where: {
                employeeId,
                clockOut: null,
            },
        });

        if (!shift) {
            return res.status(400).json({ error: 'No active shift found' });
        }

        const updatedShift = await prisma.shift.update({
            where: { id: shift.id },
            data: {
                clockOut: timestamp ? new Date(timestamp) : new Date(),
                exitMood,
                comments
            },
        });

        const log = `[${new Date().toISOString()}] SUCCESS Clock-Out: Shift ${shift.id}\n`;
        // fs.appendFileSync(logFile, log);

        res.json({ shift: updatedShift });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Get Active Shifts (Who is working now)
app.get('/shifts/active', tenantMiddleware, async (req, res) => {
    try {
        const activeShifts = await prisma.shift.findMany({
            where: {
                tenantId: req.tenantId,
                clockOut: null,
            },
            include: {
                employee: true,
            },
        });
        res.json({ shifts: activeShifts });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 4.5 Get Shift History (Report)
app.get('/shifts/history', tenantMiddleware, async (req, res) => {
    try {
        const { start, end } = req.query;

        const where = {
            tenantId: req.tenantId,
            clockOut: { not: null } // Only completed shifts
        };

        if (start && end) {
            where.clockIn = {
                gte: new Date(start),
                lte: new Date(end)
            };
        }

        const history = await prisma.shift.findMany({
            where,
            include: { employee: true },
            orderBy: { clockIn: 'desc' },
            take: 100 // Limit to last 100 for MVP speed
        });

        res.json({ shifts: history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. Get Employees (For Admin or populate)
app.get('/employees', tenantMiddleware, async (req, res) => {
    try {
        const employees = await prisma.employee.findMany({
            where: { tenantId: req.tenantId },
        });
        res.json({ employees });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 6. Create Employee
// 6. Create Employee
app.post('/employees', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        fullName: z.string(),
        role: z.string(),
        pinCode: z.string().optional(), // Can provide custom PIN or auto-generate
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        emergencyContact: z.string().optional().nullable(),
        emergencyPhone: z.string().optional().nullable(),
        birthDate: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        // Finance & HR
        govId: z.string().optional().nullable(),
        nationality: z.string().optional().nullable(),
        paymentMethod: z.string().optional().nullable(),
        bankName: z.string().optional().nullable(),
        accountNumber: z.string().optional().nullable(),
        accountHolder: z.string().optional().nullable(),
        salaryType: z.string().optional().nullable(),
        salaryAmount: z.coerce.number().optional().nullable(),
        currency: z.string().optional().nullable(),
    });

    try {
        const data = schema.parse(req.body);

        // Auto-generate 4 digit PIN if not provided
        const finalPin = data.pinCode || Math.floor(1000 + Math.random() * 9000).toString();

        const employee = await prisma.employee.create({
            data: {
                tenantId: req.tenantId,
                fullName: data.fullName,
                role: data.role,
                pinCode: finalPin,
                status: 'active',
                email: data.email,
                phone: data.phone,
                address: data.address,
                emergencyContact: data.emergencyContact,
                emergencyPhone: data.emergencyPhone,
                birthDate: (data.birthDate && data.birthDate !== '') ? new Date(data.birthDate) : null,
                startDate: (data.startDate && data.startDate !== '') ? new Date(data.startDate) : null,
                notes: data.notes,
                // Finance
                govId: data.govId,
                nationality: data.nationality,
                paymentMethod: data.paymentMethod,
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                accountHolder: data.accountHolder,
                salaryType: data.salaryType,
                salaryAmount: data.salaryAmount,
                currency: data.currency || 'USD'
            }
        });

        res.json({ employee });
    } catch (error) {
        const errorLog = `[${new Date().toISOString()}] ERROR POST Employee: ${error.message}\n${error.stack}\n`;
        // fs.appendFileSync(logFile, errorLog);
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. Update Employee
app.patch('/employees/:id', tenantMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        const allowed = [
            'fullName', 'role', 'pinCode', 'status', 'email', 'phone', 'address',
            'emergencyContact', 'emergencyPhone', 'birthDate', 'startDate', 'notes',
            // Finance & HR
            'govId', 'nationality', 'paymentMethod', 'bankName', 'accountNumber',
            'accountHolder', 'salaryType', 'salaryAmount', 'currency'
        ];
        const data = {};

        // Filter allowed fields
        Object.keys(req.body).forEach(key => {
            if (allowed.includes(key)) {
                data[key] = req.body[key];
            }
        });

        // Handle dates if present (empty string -> null)
        if (data.birthDate === '') data.birthDate = null;
        else if (data.birthDate) data.birthDate = new Date(data.birthDate);

        if (data.startDate === '') data.startDate = null;
        else if (data.startDate) data.startDate = new Date(data.startDate);

        // Handle numeric fields (empty string -> null)
        if (data.salaryAmount === '') data.salaryAmount = null;
        else if (data.salaryAmount) data.salaryAmount = parseFloat(data.salaryAmount);

        const employee = await prisma.employee.update({
            where: { id, tenantId: req.tenantId },
            data: data
        });

        // Fix: Also ensure recurring schedules are updated if they were part of the intended flow, 
        // but the current error is just the PATCH failing. 
        // The frontend calls POST /recurring separately.

        res.json({ employee });
    } catch (error) {
        const errorLog = `[${new Date().toISOString()}] ERROR PATCH Employee: ${error.message}\n${error.stack}\n`;
        // fs.appendFileSync(logFile, errorLog);
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. Delete Employee (Soft Delete)
app.delete('/employees/:id', tenantMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const employee = await prisma.employee.update({
            where: { id, tenantId: req.tenantId },
            data: { status: 'inactive' }
        });
        res.json({ employee });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


// 9. Get Schedules
app.get('/schedules', tenantMiddleware, async (req, res) => {
    try {
        const { start, end } = req.query;
        // Fetch schedules overlapping with range or all
        const schedules = await prisma.schedule.findMany({
            where: {
                tenantId: req.tenantId,
                startTime: {
                    gte: new Date(start)
                },
                endTime: {
                    lte: new Date(end)
                }
            },
            include: { employee: true }
        });
        res.json({ schedules });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. Create Schedule
app.post('/schedules', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        note: z.string().optional()
    });

    try {
        const data = schema.parse(req.body);
        const schedule = await prisma.schedule.create({
            data: {
                tenantId: req.tenantId,
                employeeId: data.employeeId,
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                note: data.note
            }
        });
        res.json({ schedule });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 11. Delete Schedule
app.delete('/schedules/:id', tenantMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.schedule.delete({
            where: { id, tenantId: req.tenantId }
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


// 12. Get Recurring Schedules (By Employee)
app.get('/recurring/:employeeId', tenantMiddleware, async (req, res) => {
    const { employeeId } = req.params;
    try {
        const recurring = await prisma.recurringSchedule.findMany({
            where: { tenantId: req.tenantId, employeeId },
            orderBy: { dayOfWeek: 'asc' }
        });
        res.json({ recurring });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 13. Upsert Recurring Schedule
app.post('/recurring', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        patterns: z.array(z.object({
            dayOfWeek: z.number(),
            startTime: z.string(),
            endTime: z.string(),
            isActive: z.boolean()
        }))
    });

    try {
        const { employeeId, patterns } = schema.parse(req.body);

        // Transaction to update all patterns for this employee
        await prisma.$transaction(
            patterns.map(p =>
                prisma.recurringSchedule.upsert({
                    where: {
                        employeeId_dayOfWeek: {
                            employeeId,
                            dayOfWeek: p.dayOfWeek
                        }
                    },
                    update: {
                        startTime: p.startTime,
                        endTime: p.endTime,
                        isActive: p.isActive,
                        tenantId: req.tenantId
                    },
                    create: {
                        tenantId: req.tenantId,
                        employeeId,
                        dayOfWeek: p.dayOfWeek,
                        startTime: p.startTime,
                        endTime: p.endTime,
                        isActive: p.isActive
                    }
                })
            )
        );

        res.json({ success: true });
    } catch (error) {
        const errorLog = `[${new Date().toISOString()}] ERROR POST Recurring: ${error.message}\n${error.stack}\n`;
        // fs.appendFileSync(logFile, errorLog);
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 14. Auto-Fill Schedule from Recurring
app.post('/schedules/autofill', tenantMiddleware, async (req, res) => {
    const schema = z.object({
        start: z.string(), // ISO String of start of week
        end: z.string()    // ISO String of end of week
    });

    try {
        const { start, end } = schema.parse(req.body);
        const startDate = new Date(start);
        const endDate = new Date(end);

        // Fetch all active recurring schedules
        const patterns = await prisma.recurringSchedule.findMany({
            where: { tenantId: req.tenantId, isActive: true }
        });

        // Generate blocks
        const newSchedules = [];
        const loopDate = new Date(startDate);

        while (loopDate <= endDate) {
            const dayOfWeek = loopDate.getDay(); // 0-6
            const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

            for (const p of dayPatterns) {
                // Construct Date objects
                const [sh, sm] = p.startTime.split(':');
                const [eh, em] = p.endTime.split(':');

                const startDateTime = new Date(loopDate);
                startDateTime.setHours(sh, sm, 0);

                const endDateTime = new Date(loopDate);
                endDateTime.setHours(eh, em, 0);

                // Add to creation list
                newSchedules.push({
                    tenantId: req.tenantId,
                    employeeId: p.employeeId,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    note: 'Auto-filled'
                });
            }

            // Next day
            loopDate.setDate(loopDate.getDate() + 1);
        }

        // Batch create
        if (newSchedules.length > 0) {
            await prisma.schedule.createMany({
                data: newSchedules
            });
        }

        res.json({ created: newSchedules.length });

    } catch (error) {
        console.error("Auto-fill error", error);
        res.status(500).json({ error: 'Server error' });
    }
});


// DOCUMENTS
app.post('/employees/:id/documents', tenantMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, type, fileData, fileName } = req.body;

    try {
        if (!fileData) return res.status(400).json({ error: 'No file data' });

        const uploadDir = path.join(__dirname, 'uploads', req.tenantId, id);
        fs.mkdirSync(uploadDir, { recursive: true });

        const buffer = Buffer.from(fileData.split(',')[1], 'base64');
        const safeName = `${Date.now()}_${fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
        const filePath = path.join(uploadDir, safeName);

        fs.writeFileSync(filePath, buffer);

        const fileUrl = `/uploads/${req.tenantId}/${id}/${safeName}`;

        const doc = await prisma.document.create({
            data: {
                tenantId: req.tenantId,
                employeeId: id,
                title: title || fileName,
                type: type || 'OTHER',
                url: fileUrl
            }
        });

        res.json(doc);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.get('/employees/:id/documents', tenantMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const docs = await prisma.document.findMany({
            where: { tenantId: req.tenantId, employeeId: id },
            orderBy: { uploadedAt: 'desc' }
        });
        res.json(docs);
    } catch (e) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// BACKUP SYSTEM (SUPER ADMIN)
app.get('/admin/backup-full', async (req, res) => {
    // 1. Simple Security Check
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'ENIGMA_MASTER_2026') {
        return res.status(403).json({ error: 'Unauthorized Access' });
    }

    try {
        console.log("Starting Full Backup...");
        const timestamp = new Date().toISOString();

        // 2. Fetch ALL Data
        const [tenants, employees, contacts] = await prisma.$transaction([
            prisma.tenant.findMany(),
            prisma.employee.findMany({
                include: {
                    documents: true,
                    payments: true,
                    recurring: true,
                    shifts: true // Include history if needed, or separate query if too large
                }
            }),
            prisma.document.findMany(), // Redundant if included in employee, but good for orphans
        ]);

        // 3. Construct Backup Object
        const backupData = {
            metadata: {
                version: "1.0",
                timestamp: timestamp,
                type: "FULL_DUMP"
            },
            data: {
                tenants,
                employees, // Includes relations
            }
        };

        res.json(backupData);
    } catch (e) {
        console.error("Backup Failed", e);
        res.status(500).json({ error: 'Backup generation failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Enigma Staff Server running on port ${PORT}`);
});
