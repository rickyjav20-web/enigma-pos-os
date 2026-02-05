
import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq'; // Default tenant

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function createEmployee(data: any) {
    console.log(`Creating employee: ${data.fullName}...`);
    const res = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to create employee ${data.fullName}: ${err}`);
    }

    const json = await res.json();
    console.log(`✅ Created ${data.fullName} (ID: ${json.employee.id})`);
    return json.employee;
}

async function createSchedule(employeeId: string, start: Date, end: Date, note: string) {
    console.log(`  -> Adding schedule: ${start.toISOString()} - ${end.toISOString()}`);
    const res = await fetch(`${API_URL}/schedules`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify({
            employeeId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            note
        })
    });

    if (!res.ok) {
        throw new Error(`Failed to create schedule: ${await res.text()}`);
    }
    console.log(`  ✅ Schedule added`);
}

async function createRecurring(employeeId: string, patterns: any[]) {
    console.log(`  -> Setting recurring schedule...`);
    const res = await fetch(`${API_URL}/recurring`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify({
            employeeId,
            patterns
        })
    });

    if (!res.ok) {
        throw new Error(`Failed to create recurring: ${await res.text()}`);
    }
    console.log(`  ✅ Recurring schedule set`);
}

async function main() {
    try {
        console.log('--- STARTING STAFF POPULATION ---');

        // User 1: Juan Perez (Barista)
        const juan = await createEmployee({
            fullName: 'Juan Perez',
            role: 'Barista',
            pinCode: '1234',
            email: 'juan.perez@enigma.cafe',
            phone: '+58 414-1234567',
            address: 'Av. Principal, San Cristobal',
            birthDate: '1995-05-15',
            startDate: '2024-01-01',
            salaryType: 'hourly',
            salaryAmount: 5.00,
            currency: 'USD',
            paymentMethod: 'cash',
            notes: 'Usuario de prueba - Barista'
        });

        // Juan Schedule: Today 8am-4pm
        const today8am = new Date(); today8am.setHours(8, 0, 0, 0);
        const today4pm = new Date(); today4pm.setHours(16, 0, 0, 0);
        await createSchedule(juan.id, today8am, today4pm, 'Turno regular');

        // Juan Recurring: Mon-Fri 8am-4pm
        await createRecurring(juan.id, [
            { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isActive: true },
            { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', isActive: true },
            { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', isActive: true },
            { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', isActive: true },
            { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isActive: true },
        ]);


        // User 2: Maria Gonzalez (Cajera)
        const maria = await createEmployee({
            fullName: 'Maria Gonzalez',
            role: 'Cajera',
            pinCode: '5678', // Fixed PIN for testing
            email: 'maria.gonzalez@enigma.cafe',
            phone: '+58 424-7654321',
            address: 'Barrio Obrero, SC',
            birthDate: '1998-10-20',
            startDate: '2024-02-01',
            salaryType: 'fixed',
            salaryAmount: 300.00,
            currency: 'USD',
            paymentMethod: 'transfer',
            bankName: 'Mercantil',
            accountNumber: '0105-0000-00-0000000000',
            accountHolder: 'Maria Gonzalez',
            notes: 'Usuario de prueba - Cajera'
        });

        // Maria Schedule: Today 2pm-10pm
        const today2pm = new Date(); today2pm.setHours(14, 0, 0, 0);
        const today10pm = new Date(); today10pm.setHours(22, 0, 0, 0);
        await createSchedule(maria.id, today2pm, today10pm, 'Cierre');

        // Maria Recurring: Mon-Fri 2pm-10pm
        await createRecurring(maria.id, [
            { dayOfWeek: 1, startTime: '14:00', endTime: '22:00', isActive: true },
            { dayOfWeek: 2, startTime: '14:00', endTime: '22:00', isActive: true },
            { dayOfWeek: 3, startTime: '14:00', endTime: '22:00', isActive: true },
            { dayOfWeek: 4, startTime: '14:00', endTime: '22:00', isActive: true },
            { dayOfWeek: 5, startTime: '14:00', endTime: '22:00', isActive: true },
        ]);

        console.log('--- POPULATION COMPLETE ---');
        console.log('USERS CREATED:');
        console.log('1. Juan Perez (Barista) - PIN: 1234');
        console.log('2. Maria Gonzalez (Cajera) - PIN: 5678');

    } catch (e) {
        console.error('ERROR:', e);
    }
}

main();
