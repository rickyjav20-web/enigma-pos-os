import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

// ─── Presets ─────────────────────────────────────────────────────────────────
// Revenue-backed presets based on hospitality industry standards.
// Each value is calibrated to protect revenue at scale:
// Standard 20-table restaurant loses ~$33K/month if turn time rises from 60→80 min.
const PRESETS = {
    casual: {
        label: 'Casual / Fast Casual',
        description: 'Cafeterías, coffee shops, fast food, taquerías — check ~$15, 150+ covers/noche',
        reviewThresholdMin: 2,       // 2-min check — upsell window ("otro café?") exists here or not at all
        urgencyWarningMin: 20,       // At 20 min a 30-min turn table is at risk of blowing capacity
        autoRefreshSec: 15,          // High volume, fast turns — need near-real-time visibility
        tableTurnTargetMin: 30,      // 12 seatings/table in 6hr peak = $180/table/day at $15 check
        staleTicketAlertMin: 45,     // 50% over target — likely forgotten tab or walkout
        kdsPrepTimeWarningMin: 8,    // Café items should fire in 5-7 min; 8 = cascade risk
        sobremesaMin: 10,            // Fast casual — guests eat quickly, re-check in 10 min
        deliveryBufferMin: 1,        // 1 min from KDS done to "servida" (food transit from kitchen)
    },
    standard: {
        label: 'Restaurante Estándar',
        description: 'Servicio completo, trattoria, bistró — check ~$55, 80-150 covers/noche',
        reviewThresholdMin: 3,       // Classic 3-min check: catch errors + "otra ronda?" = +15-20% check
        urgencyWarningMin: 35,       // 35 min sin actividad = mesa olvidada o campista sin gasto
        autoRefreshSec: 30,          // Moderate pace; 2x/min refresh catches stalls before complaints
        tableTurnTargetMin: 60,      // 4 turns in 4hr service = $4,400/noche (20 mesas x $55)
        staleTicketAlertMin: 90,     // At 90 min: forgotten tab, shift-change miss, or walkout risk
        kdsPrepTimeWarningMin: 15,   // Entrees fire in 10-14 min; 15 = server should manage guest expectation
        sobremesaMin: 15,            // Standard dining — comfortable 15-min window after check-back
        deliveryBufferMin: 1,        // 1 min from KDS done to "servida" (food transit from kitchen)
    },
    fine_dining: {
        label: 'Fine Dining / Premium',
        description: 'Fine dining, tasting menu, omakase — check ~$150, 30-60 covers/noche',
        reviewThresholdMin: 4,       // Unhurried but attentive; missed error at $150+ check = $40-60 comp
        urgencyWarningMin: 50,       // Long dwell expected, but 50 min dead air = broken pacing
        autoRefreshSec: 45,          // Fewer tables, maître d' on floor; 45s catches anomalies
        tableTurnTargetMin: 105,     // 5-7 course tasting in 105 min allows second partial seating
        staleTicketAlertMin: 150,    // Even luxury meals should be in final act at 2.5 hrs
        kdsPrepTimeWarningMin: 22,   // Complex dishes take 15-20 min; 22 catches genuine delays
        sobremesaMin: 25,            // Fine dining — leisurely pace, 25 min between check-backs
        deliveryBufferMin: 2,        // 2 min — fine dining has longer plating + runner walk
    },
} as const;

type PresetKey = keyof typeof PRESETS;

// Default config when none exists
const DEFAULT_CONFIG = {
    preset: 'standard' as string,
    ...PRESETS.standard,
};

export default async function tableFlowConfigRoutes(fastify: FastifyInstance) {

    // GET /table-flow-config — get current config (or default)
    fastify.get('/table-flow-config', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const config = await prisma.tableFlowConfig.findUnique({
            where: { tenantId },
        });

        if (!config) {
            return reply.send({ success: true, data: { tenantId, ...DEFAULT_CONFIG } });
        }

        return reply.send({ success: true, data: config });
    });

    // GET /table-flow-config/presets — list available presets
    fastify.get('/table-flow-config/presets', async (_request, reply) => {
        const presets = Object.entries(PRESETS).map(([key, value]) => ({
            key,
            ...value,
        }));
        return reply.send({ success: true, data: presets });
    });

    // PUT /table-flow-config — update config (apply preset or custom values)
    const updateSchema = z.object({
        preset: z.enum(['casual', 'standard', 'fine_dining', 'custom']),
        reviewThresholdMin: z.number().int().min(1).max(120).optional(),
        urgencyWarningMin: z.number().int().min(5).max(180).optional(),
        autoRefreshSec: z.number().int().min(5).max(120).optional(),
        tableTurnTargetMin: z.number().int().min(10).max(300).optional(),
        staleTicketAlertMin: z.number().int().min(5).max(300).optional(),
        kdsPrepTimeWarningMin: z.number().int().min(3).max(60).optional(),
        sobremesaMin: z.number().int().min(3).max(120).optional(),
        deliveryBufferMin: z.number().int().min(0).max(10).optional(),
    });

    fastify.put('/table-flow-config', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = updateSchema.parse(request.body);

        // If a preset is selected (not custom), use its values
        let values: {
            reviewThresholdMin: number;
            urgencyWarningMin: number;
            autoRefreshSec: number;
            tableTurnTargetMin: number;
            staleTicketAlertMin: number;
            kdsPrepTimeWarningMin: number;
            sobremesaMin: number;
            deliveryBufferMin: number;
        };

        if (body.preset !== 'custom' && body.preset in PRESETS) {
            const presetData = PRESETS[body.preset as PresetKey];
            values = {
                reviewThresholdMin: presetData.reviewThresholdMin,
                urgencyWarningMin: presetData.urgencyWarningMin,
                autoRefreshSec: presetData.autoRefreshSec,
                tableTurnTargetMin: presetData.tableTurnTargetMin,
                staleTicketAlertMin: presetData.staleTicketAlertMin,
                kdsPrepTimeWarningMin: presetData.kdsPrepTimeWarningMin,
                sobremesaMin: presetData.sobremesaMin,
                deliveryBufferMin: presetData.deliveryBufferMin,
            };
        } else {
            // Custom — use provided values or keep existing
            const existing = await prisma.tableFlowConfig.findUnique({ where: { tenantId } });
            values = {
                reviewThresholdMin: body.reviewThresholdMin ?? existing?.reviewThresholdMin ?? DEFAULT_CONFIG.reviewThresholdMin,
                urgencyWarningMin: body.urgencyWarningMin ?? existing?.urgencyWarningMin ?? DEFAULT_CONFIG.urgencyWarningMin,
                autoRefreshSec: body.autoRefreshSec ?? existing?.autoRefreshSec ?? DEFAULT_CONFIG.autoRefreshSec,
                tableTurnTargetMin: body.tableTurnTargetMin ?? existing?.tableTurnTargetMin ?? DEFAULT_CONFIG.tableTurnTargetMin,
                staleTicketAlertMin: body.staleTicketAlertMin ?? existing?.staleTicketAlertMin ?? DEFAULT_CONFIG.staleTicketAlertMin,
                kdsPrepTimeWarningMin: body.kdsPrepTimeWarningMin ?? existing?.kdsPrepTimeWarningMin ?? DEFAULT_CONFIG.kdsPrepTimeWarningMin,
                sobremesaMin: body.sobremesaMin ?? existing?.sobremesaMin ?? DEFAULT_CONFIG.sobremesaMin,
                deliveryBufferMin: body.deliveryBufferMin ?? existing?.deliveryBufferMin ?? DEFAULT_CONFIG.deliveryBufferMin,
            };
        }

        const config = await prisma.tableFlowConfig.upsert({
            where: { tenantId },
            create: {
                tenantId,
                preset: body.preset,
                ...values,
            },
            update: {
                preset: body.preset,
                ...values,
            },
        });

        return reply.send({ success: true, data: config });
    });
}
