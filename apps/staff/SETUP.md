# Enigma Staff - Setup Instructions

Since the automated setup encountered environment issues, please follow these steps to initialize and run the application.

## Prerequisites
- Node.js (v16+)
- PostgreSQL installed and running

## 1. Backend Setup
Open a terminal in `enigma-staff/server`:
```bash
cd enigma-staff/server
npm install
```

### Database Configuration
1. Create a `.env` file in `server/`:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/enigmastaff?schema=public"
   PORT=3000
   ```
   *(Replace USER and PASSWORD with your local Postgres credentials)*

2. Initialize Database:
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

### Run Server
```bash
npm run dev
```

## 2. Frontend Setup
Open a new terminal in `enigma-staff/client`:
```bash
cd enigma-staff/client
npm install
```

### Run Client
```bash
npm run dev
```

## 3. Usage
- **Kiosk**: http://localhost:5173/kiosk (PIN: 0000)
- **Admin**: http://localhost:5173/admin
