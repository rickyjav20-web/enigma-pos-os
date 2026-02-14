
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



    // --- GET AUDIT SUMMARY (Calculated vs Declared) ---
    fastify.get('/register/audit/:sessionId', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        const session = await prisma.registerSession.findUnique({
            where: { id: sessionId },
            include: { transactions: true }
        });

        if (!session) return reply.status(404).send({ error: "Session not found" });

        // Categorize transactions 
        let salesTotal = 0;
        let purchasesTotal = 0;
        let expensesTotal = 0;
        let depositsTotal = 0;
        let withdrawalsTotal = 0;

        for (const tx of session.transactions) {
            switch (tx.type) {
                case 'SALE': salesTotal += tx.amount; break;
                case 'PURCHASE': purchasesTotal += tx.amount; break;
                case 'EXPENSE': expensesTotal += tx.amount; break;
                case 'DEPOSIT': depositsTotal += tx.amount; break;
                case 'WITHDRAWAL': withdrawalsTotal += tx.amount; break;
                // 'OPENING' is usually ignored here as we start from startingCash
            }
        }

        // Expected Cash = Starting + (Sales + Deposits) - (Purchases + Expenses + Withdrawals)
        // Since amounts for outflows are typically negative in transactions, simple summation works if logic is consistent
        // However, let's verify if the stored 'amount' is signed.

        let calculatedExpected = session.startingCash;
        for (const tx of session.transactions) {
            calculatedExpected += tx.amount;
        }

        return {
            startingCash: session.startingCash,
            transactionsTotal: calculatedExpected - session.startingCash,
            expectedCash: calculatedExpected,
            declaredCash: session.declaredCash || 0,
            difference: (session.declaredCash || 0) - calculatedExpected,
            breakdown: {
                sales: salesTotal,
                deposits: depositsTotal,
                purchases: Math.abs(purchasesTotal), // Return positive for display logic
                expenses: Math.abs(expensesTotal),
                withdrawals: Math.abs(withdrawalsTotal)
            },
            transactionCount: session.transactions.length
        };
    });
}
