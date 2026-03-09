import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

// ─── Presets ─────────────────────────────────────────────────────────────────
const PRESETS = {
    casual: {
        label: 'Casual / Fast Casual',
        description: 'Cafeterías, coffee shops, fast food, taquerías',
        reviewThresholdMin: 5,
        urgencyWarningMin: 15,
        autoRefreshSec: 10,
        tableTurnTargetMin: 30,
        staleTicketAlertMin: 10,
        kdsPrepTimeWarningMin: 8,
    },
    standard: {
        label: 'Restaurante Estándar',
        description: 'Servicio completo, trattoria, bistró, gastropub',
        reviewThresholdMin: 10,
        urgencyWarningMin: 30,
        autoRefreshSec: 15,
        tableTurnTargetMin: 60,
        staleTicketAlertMin: 20,
        kdsPrepTimeWarningMin: 15,
    },
    fine_dining: {
        label: 'Fine Dining / Premium',
        description: 'Fine dining, tasting menu, chef\'s table, omakase',
        reviewThresholdMin: 15,
        urgencyWarningMin: 50,
        autoRefreshSec: 30,
        tableTurnTargetMin: 120,
        staleTicketAlertMin: 40,
        kdsPrepTimeWarningMin: 25,
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
        staleTicketAlertMin: z.number().int().min(5).max(120).optional(),
        kdsPrepTimeWarningMin: z.number().int().min(3).max(60).optional(),
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
