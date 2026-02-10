
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export default async function transactionRoutes(fastify: FastifyInstance) {

    // --- GET TRANSACTIONS FOR SESSION ---
    fastify.get('/register/transactions/:sessionId', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        // Verify session exists
        const session = await prisma.registerSession.findUnique({ where: { id: sessionId } });
        if (!session) return reply.status(404).send({ error: 'Session not found' });

        const transactions = await prisma.cashTransaction.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'desc' }
        });
        return transactions;
    });

    // --- CREATE MANUAL TRANSACTION (Pay In / Pay Out / Expense / Sale) ---
    const transactionSchema = z.object({
        sessionId: z.string(),
        amount: z.number(), // Positive for inflows, Negative for outflows
        type: z.enum(['OPENING', 'SALE', 'PURCHASE', 'EXPENSE', 'WITHDRAWAL', 'DEPOSIT']),
        description: z.string().min(1, 'Description required').max(500),
        referenceId: z.string().optional()
    });

    fastify.post('/register/transaction', async (request, reply) => {
        const data = transactionSchema.parse(request.body);

        // Security: Verify session exists and is OPEN
        const session = await prisma.registerSession.findUnique({
            where: { id: data.sessionId }
        });

        if (!session) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        if (session.status !== 'open') {
            return reply.status(400).send({ error: 'Cannot add transactions to a closed session' });
        }

        // Security: Validate amount limits (anti-exploit)
        if (Math.abs(data.amount) > 100000) {
            return reply.status(400).send({ error: 'Transaction amount exceeds maximum allowed' });
        }

        // Security: Validate sign matches type
        if (data.type === 'SALE' && data.amount < 0) {
            return reply.status(400).send({ error: 'Sale amount must be positive' });
        }
        if (data.type === 'EXPENSE' && data.amount > 0) {
            return reply.status(400).send({ error: 'Expense amount must be negative' });
        }

        const transaction = await prisma.cashTransaction.create({
            data: {
                sessionId: data.sessionId,
                amount: data.amount,
                type: data.type,
                description: data.description,
                referenceId: data.referenceId
            }
        });

        return transaction;
    });

    // --- GET AUDIT SUMMARY (Calculated vs Declared) ---
    fastify.get('/register/audit/:sessionId', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        const session = await prisma.registerSession.findUnique({
            where: { id: sessionId },
            include: { transactions: true }
        });

        if (!session) return reply.status(404).send({ error: "Session not found" });

        // Calculate System Expected Cash
        let expectedCash = session.startingCash;

        // Categorize transactions 
        let salesTotal = 0;
        let purchasesTotal = 0;
        let expensesTotal = 0;
        let otherTotal = 0;

        for (const tx of session.transactions) {
            expectedCash += tx.amount;
            switch (tx.type) {
                case 'SALE': salesTotal += tx.amount; break;
                case 'PURCHASE': purchasesTotal += tx.amount; break;
                case 'EXPENSE': expensesTotal += tx.amount; break;
                default: otherTotal += tx.amount; break;
            }
        }

        return {
            startingCash: session.startingCash,
            transactionsTotal: expectedCash - session.startingCash,
            expectedCash,
            declaredCash: session.declaredCash || 0,
            difference: (session.declaredCash || 0) - expectedCash,
            breakdown: {
                sales: salesTotal,
                purchases: purchasesTotal,
                expenses: expensesTotal,
                other: otherTotal
            },
            transactionCount: session.transactions.length
        };
    });
}
