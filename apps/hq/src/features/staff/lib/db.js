import Dexie from 'dexie';

export const db = new Dexie('EnigmaStaffDB');

db.version(1).stores({
    pendingShifts: '++id, tenantId, employeeId, mood, photoUrl, clockIn, timestamp', // For offline syncing
    settings: 'key, value' // Store tenant config if needed
});
