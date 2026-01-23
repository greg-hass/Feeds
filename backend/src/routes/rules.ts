import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
    getRules,
    getRule,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    testRule,
    getRuleExecutions,
    getRuleStats,
    RuleCondition,
    RuleAction,
} from '../services/rules-engine.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ruleConditionSchema = z.object({
    field: z.enum(['title', 'content', 'feed_id', 'author', 'url', 'type', 'tags']),
    operator: z.enum(['contains', 'not_contains', 'equals', 'not_equals', 'matches_regex', 'in', 'not_in']),
    value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
    case_sensitive: z.boolean().optional(),
});

const ruleActionSchema = z.object({
    type: z.enum(['move_to_folder', 'add_tag', 'mark_read', 'bookmark', 'delete', 'notify']),
    params: z.object({
        folder_id: z.number().optional(),
        tag: z.string().optional(),
        message: z.string().optional(),
    }),
});

const createRuleSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    trigger_type: z.enum(['new_article', 'keyword_match', 'feed_match', 'author_match']),
    conditions: z.array(ruleConditionSchema),
    actions: z.array(ruleActionSchema).min(1),
    priority: z.number().int().min(0).max(100).default(0),
});

const updateRuleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional(),
    conditions: z.array(ruleConditionSchema).optional(),
    actions: z.array(ruleActionSchema).min(1).optional(),
    priority: z.number().int().min(0).max(100).optional(),
});

const testRuleSchema = z.object({
    conditions: z.array(ruleConditionSchema),
    actions: z.array(ruleActionSchema),
    limit: z.number().int().min(1).max(100).default(10),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function rulesRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1; // Single-user system

    // ========================================================================
    // CRUD OPERATIONS
    // ========================================================================

    /**
     * Get all automation rules
     * GET /rules?enabled_only=false
     */
    app.get('/', async (request: FastifyRequest<{ Querystring: { enabled_only?: string } }>) => {
        const enabledOnly = request.query.enabled_only === 'true';
        const rules = getRules(userId, enabledOnly);
        return { rules };
    });

    /**
     * Get a single rule by ID
     * GET /rules/:id
     */
    app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const ruleId = parseInt(request.params.id);

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        const rule = getRule(ruleId, userId);

        if (!rule) {
            return { error: 'Rule not found' };
        }

        return { rule };
    });

    /**
     * Create a new automation rule
     * POST /rules
     */
    app.post('/', async (request: FastifyRequest) => {
        const body = createRuleSchema.parse(request.body);

        const ruleId = createRule(
            userId,
            body.name,
            body.trigger_type,
            body.conditions as RuleCondition[],
            body.actions as RuleAction[],
            body.description,
            body.priority
        );

        const rule = getRule(ruleId, userId);

        return { rule };
    });

    /**
     * Update an existing rule
     * PATCH /rules/:id
     */
    app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const ruleId = parseInt(request.params.id);

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        const body = updateRuleSchema.parse(request.body);

        updateRule(ruleId, userId, {
            ...body,
            conditions: body.conditions as RuleCondition[] | undefined,
            actions: body.actions as RuleAction[] | undefined,
        });

        const rule = getRule(ruleId, userId);

        return { rule };
    });

    /**
     * Delete a rule
     * DELETE /rules/:id
     */
    app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const ruleId = parseInt(request.params.id);

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        deleteRule(ruleId, userId);

        return { success: true };
    });

    /**
     * Toggle rule enabled status
     * POST /rules/:id/toggle
     */
    app.post('/:id/toggle', async (request: FastifyRequest<{
        Params: { id: string };
        Body: { enabled: boolean };
    }>) => {
        const ruleId = parseInt(request.params.id);

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        const { enabled } = request.body as { enabled: boolean };

        toggleRule(ruleId, userId, enabled);

        const rule = getRule(ruleId, userId);

        return { rule };
    });

    // ========================================================================
    // TESTING & ANALYTICS
    // ========================================================================

    /**
     * Test a rule against existing articles (dry run)
     * POST /rules/test
     */
    app.post('/test', async (request: FastifyRequest) => {
        const body = testRuleSchema.parse(request.body);

        const results = testRule(
            userId,
            body.conditions as RuleCondition[],
            body.actions as RuleAction[],
            body.limit
        );

        const matchCount = results.filter(r => r.would_match).length;

        return {
            total_tested: results.length,
            match_count: matchCount,
            results: results.map(r => ({
                article_id: r.article.id,
                article_title: r.article.title,
                would_match: r.would_match,
                would_execute_actions: r.would_execute_actions,
            })),
        };
    });

    /**
     * Get execution history for a rule
     * GET /rules/:id/executions?limit=50
     */
    app.get('/:id/executions', async (request: FastifyRequest<{
        Params: { id: string };
        Querystring: { limit?: string };
    }>) => {
        const ruleId = parseInt(request.params.id);
        const limit = parseInt(request.query.limit || '50');

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        const executions = getRuleExecutions(ruleId, limit);

        return { executions };
    });

    /**
     * Get rule statistics
     * GET /rules/:id/stats
     */
    app.get('/:id/stats', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const ruleId = parseInt(request.params.id);

        if (isNaN(ruleId)) {
            return { error: 'Invalid rule ID' };
        }

        const stats = getRuleStats(ruleId);

        return { stats };
    });

    // ========================================================================
    // BULK OPERATIONS
    // ========================================================================

    /**
     * Bulk enable/disable rules
     * POST /rules/bulk/toggle
     */
    app.post('/bulk/toggle', async (request: FastifyRequest<{
        Body: { rule_ids: number[]; enabled: boolean };
    }>) => {
        const { rule_ids, enabled } = request.body as { rule_ids: number[]; enabled: boolean };

        for (const ruleId of rule_ids) {
            toggleRule(ruleId, userId, enabled);
        }

        return { success: true, updated_count: rule_ids.length };
    });

    /**
     * Bulk delete rules
     * POST /rules/bulk/delete
     */
    app.post('/bulk/delete', async (request: FastifyRequest<{
        Body: { rule_ids: number[] };
    }>) => {
        const { rule_ids } = request.body as { rule_ids: number[] };

        for (const ruleId of rule_ids) {
            deleteRule(ruleId, userId);
        }

        return { success: true, deleted_count: rule_ids.length };
    });
}
