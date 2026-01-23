import { queryAll, queryOne, run } from '../db/index.js';

// Alias for convenience
const query = queryAll;

// ============================================================================
// TYPES
// ============================================================================

// Article type used for rule evaluation
export interface Article {
    id: number;
    user_id: number;
    feed_id: number;
    guid: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    type?: string;
    folder_id?: number | null;
    is_bookmarked?: boolean;
    published_at: string | null;
    fetched_at: string;
}

export interface AutomationRule {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    enabled: boolean;
    trigger_type: 'new_article' | 'keyword_match' | 'feed_match' | 'author_match';
    conditions: RuleCondition[];
    actions: RuleAction[];
    priority: number;
    match_count: number;
    last_matched_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface RuleCondition {
    field: 'title' | 'content' | 'feed_id' | 'author' | 'url' | 'type' | 'tags';
    operator: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'matches_regex' | 'in' | 'not_in';
    value: string | string[] | number | number[];
    case_sensitive?: boolean;
}

export interface RuleAction {
    type: 'move_to_folder' | 'add_tag' | 'mark_read' | 'bookmark' | 'delete' | 'notify';
    params: {
        folder_id?: number;
        tag?: string;
        message?: string;
    };
}

export interface RuleExecution {
    id: number;
    rule_id: number;
    article_id: number;
    executed_at: string;
    success: boolean;
    actions_taken: RuleAction[];
    error_message: string | null;
}

export interface RuleEvaluationResult {
    matched: boolean;
    rule: AutomationRule;
    actions_executed: RuleAction[];
    error?: string;
}

// ============================================================================
// RULE CRUD
// ============================================================================

// DB row type for rules (JSON fields are strings)
interface AutomationRuleRow {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    enabled: boolean;
    trigger_type: 'new_article' | 'keyword_match' | 'feed_match' | 'author_match';
    conditions: string; // JSON string in DB
    actions: string; // JSON string in DB
    priority: number;
    match_count: number;
    last_matched_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get all rules for a user
 */
export function getRules(userId: number, enabledOnly: boolean = false): AutomationRule[] {
    const sql = enabledOnly
        ? 'SELECT * FROM automation_rules WHERE user_id = ? AND enabled = 1 ORDER BY priority DESC, id ASC'
        : 'SELECT * FROM automation_rules WHERE user_id = ? ORDER BY priority DESC, id ASC';

    const rules = query<AutomationRuleRow>(sql, [userId]);

    return rules.map((rule: AutomationRuleRow) => ({
        ...rule,
        conditions: JSON.parse(rule.conditions) as RuleCondition[],
        actions: JSON.parse(rule.actions) as RuleAction[],
    }));
}

/**
 * Get a single rule by ID
 */
export function getRule(ruleId: number, userId: number): AutomationRule | null {
    const rule = queryOne<AutomationRuleRow>(
        'SELECT * FROM automation_rules WHERE id = ? AND user_id = ?',
        [ruleId, userId]
    );

    if (!rule) return null;

    return {
        ...rule,
        conditions: JSON.parse(rule.conditions) as RuleCondition[],
        actions: JSON.parse(rule.actions) as RuleAction[],
    };
}

/**
 * Create a new automation rule
 */
export function createRule(
    userId: number,
    name: string,
    triggerType: AutomationRule['trigger_type'],
    conditions: RuleCondition[],
    actions: RuleAction[],
    description?: string,
    priority: number = 0
): number {
    const result = run(
        `INSERT INTO automation_rules (user_id, name, description, trigger_type, conditions, actions, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, description || null, triggerType, JSON.stringify(conditions), JSON.stringify(actions), priority]
    );
    return result.lastInsertRowid as number;
}

/**
 * Update an existing rule
 */
export function updateRule(
    ruleId: number,
    userId: number,
    updates: Partial<Pick<AutomationRule, 'name' | 'description' | 'enabled' | 'conditions' | 'actions' | 'priority'>>
): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
    }
    if (updates.description !== undefined) {
        setClauses.push('description = ?');
        values.push(updates.description);
    }
    if (updates.enabled !== undefined) {
        setClauses.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
    }
    if (updates.conditions !== undefined) {
        setClauses.push('conditions = ?');
        values.push(JSON.stringify(updates.conditions));
    }
    if (updates.actions !== undefined) {
        setClauses.push('actions = ?');
        values.push(JSON.stringify(updates.actions));
    }
    if (updates.priority !== undefined) {
        setClauses.push('priority = ?');
        values.push(updates.priority);
    }

    setClauses.push('updated_at = datetime("now")');

    values.push(ruleId, userId);

    run(
        `UPDATE automation_rules SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
        values
    );
}

/**
 * Delete a rule
 */
export function deleteRule(ruleId: number, userId: number): void {
    run('DELETE FROM automation_rules WHERE id = ? AND user_id = ?', [ruleId, userId]);
}

/**
 * Toggle rule enabled status
 */
export function toggleRule(ruleId: number, userId: number, enabled: boolean): void {
    run(
        'UPDATE automation_rules SET enabled = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
        [enabled ? 1 : 0, ruleId, userId]
    );
}

// ============================================================================
// RULE EVALUATION
// ============================================================================

/**
 * Evaluate a single condition against an article
 */
function evaluateCondition(condition: RuleCondition, article: Article): boolean {
    let fieldValue: any;

    // Extract field value from article
    switch (condition.field) {
        case 'title':
            fieldValue = article.title;
            break;
        case 'content':
            fieldValue = article.content || article.summary || '';
            break;
        case 'feed_id':
            fieldValue = article.feed_id;
            break;
        case 'author':
            fieldValue = article.author || '';
            break;
        case 'url':
            fieldValue = article.url || '';
            break;
        case 'type':
            fieldValue = article.type || 'rss';
            break;
        case 'tags':
            // Query tags for this article
            const tags = query<{ tag: string }>(
                'SELECT tag FROM article_tags WHERE article_id = ?',
                [article.id]
            );
            fieldValue = tags.map((t: { tag: string }) => t.tag);
            break;
        default:
            return false;
    }

    // Apply operator
    const caseSensitive = condition.case_sensitive !== false;

    switch (condition.operator) {
        case 'contains':
            if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
            const searchValue = caseSensitive ? condition.value : condition.value.toLowerCase();
            const searchField = caseSensitive ? fieldValue : fieldValue.toLowerCase();
            return searchField.includes(searchValue);

        case 'not_contains':
            if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
            const notSearchValue = caseSensitive ? condition.value : condition.value.toLowerCase();
            const notSearchField = caseSensitive ? fieldValue : fieldValue.toLowerCase();
            return !notSearchField.includes(notSearchValue);

        case 'equals':
            if (caseSensitive) {
                return fieldValue === condition.value;
            } else {
                const v1 = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue;
                const v2 = typeof condition.value === 'string' ? condition.value.toLowerCase() : condition.value;
                return v1 === v2;
            }

        case 'not_equals':
            if (caseSensitive) {
                return fieldValue !== condition.value;
            } else {
                const v1 = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue;
                const v2 = typeof condition.value === 'string' ? condition.value.toLowerCase() : condition.value;
                return v1 !== v2;
            }

        case 'matches_regex':
            if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
            try {
                const regex = new RegExp(condition.value, caseSensitive ? '' : 'i');
                return regex.test(fieldValue);
            } catch {
                return false;
            }

        case 'in':
            if (!Array.isArray(condition.value)) return false;
            if (caseSensitive) {
                return (condition.value as (string | number)[]).includes(fieldValue as string | number);
            } else {
                const lowerValues = (condition.value as (string | number)[]).map((v: string | number) => typeof v === 'string' ? v.toLowerCase() : v);
                const lowerField = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue;
                return lowerValues.includes(lowerField);
            }

        case 'not_in':
            if (!Array.isArray(condition.value)) return false;
            if (caseSensitive) {
                return !(condition.value as (string | number)[]).includes(fieldValue as string | number);
            } else {
                const lowerValues = (condition.value as (string | number)[]).map((v: string | number) => typeof v === 'string' ? v.toLowerCase() : v);
                const lowerField = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue;
                return !lowerValues.includes(lowerField);
            }

        default:
            return false;
    }
}

/**
 * Evaluate all conditions for a rule (AND logic)
 */
function evaluateRuleConditions(rule: AutomationRule, article: Article): boolean {
    if (rule.conditions.length === 0) return true;

    // All conditions must match (AND logic)
    return rule.conditions.every(condition => evaluateCondition(condition, article));
}

/**
 * Execute a single action
 */
function executeAction(action: RuleAction, article: Article): void {
    switch (action.type) {
        case 'move_to_folder':
            if (action.params.folder_id !== undefined) {
                run(
                    'UPDATE articles SET folder_id = ?, updated_at = datetime("now") WHERE id = ?',
                    [action.params.folder_id, article.id]
                );
            }
            break;

        case 'add_tag':
            if (action.params.tag) {
                run(
                    `INSERT OR IGNORE INTO article_tags (article_id, tag, source)
                     VALUES (?, ?, 'rule')`,
                    [article.id, action.params.tag]
                );
            }
            break;

        case 'mark_read':
            run(
                `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read)
                 VALUES (?, ?, 1)`,
                [article.user_id, article.id]
            );
            break;

        case 'bookmark':
            run(
                'UPDATE articles SET is_bookmarked = 1, updated_at = datetime("now") WHERE id = ?',
                [article.id]
            );
            break;

        case 'delete':
            run(
                'UPDATE articles SET deleted_at = datetime("now") WHERE id = ?',
                [article.id]
            );
            break;

        case 'notify':
            // TODO: Implement notification system (webhook, email, etc.)
            console.log(`[Rule Notification] ${action.params.message || 'Rule matched'} for article: ${article.title}`);
            break;
    }
}

/**
 * Evaluate and execute a single rule against an article
 */
export function evaluateRule(rule: AutomationRule, article: Article): RuleEvaluationResult {
    try {
        // Check if rule conditions match
        const matched = evaluateRuleConditions(rule, article);

        if (!matched) {
            return { matched: false, rule, actions_executed: [] };
        }

        // Execute all actions
        const actionsExecuted: RuleAction[] = [];
        for (const action of rule.actions) {
            executeAction(action, article);
            actionsExecuted.push(action);
        }

        // Log execution
        run(
            `INSERT INTO rule_executions (rule_id, article_id, success, actions_taken)
             VALUES (?, ?, 1, ?)`,
            [rule.id, article.id, JSON.stringify(actionsExecuted)]
        );

        return { matched: true, rule, actions_executed: actionsExecuted };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Log failed execution
        run(
            `INSERT INTO rule_executions (rule_id, article_id, success, error_message)
             VALUES (?, ?, 0, ?)`,
            [rule.id, article.id, errorMessage]
        );

        return { matched: false, rule, actions_executed: [], error: errorMessage };
    }
}

/**
 * Evaluate all enabled rules against an article
 */
export function evaluateRulesForArticle(userId: number, article: Article): RuleEvaluationResult[] {
    const rules = getRules(userId, true); // Get enabled rules only
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
        // Check trigger type
        const shouldEvaluate =
            rule.trigger_type === 'new_article' ||
            (rule.trigger_type === 'feed_match' && rule.conditions.some(c => c.field === 'feed_id')) ||
            (rule.trigger_type === 'keyword_match' && rule.conditions.some(c => c.field === 'title' || c.field === 'content')) ||
            (rule.trigger_type === 'author_match' && rule.conditions.some(c => c.field === 'author'));

        if (!shouldEvaluate) continue;

        const result = evaluateRule(rule, article);
        results.push(result);

        // Stop after first match if rule is high priority
        if (result.matched && rule.priority > 50) {
            break;
        }
    }

    return results;
}

/**
 * Test a rule against existing articles (dry run)
 */
export function testRule(
    userId: number,
    conditions: RuleCondition[],
    actions: RuleAction[],
    limit: number = 10
): { article: Article; would_match: boolean; would_execute_actions: RuleAction[] }[] {
    const articles = query<Article>(
        `SELECT * FROM articles
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY published_at DESC
         LIMIT ?`,
        [userId, limit]
    );

    const testRule: AutomationRule = {
        id: -1,
        user_id: userId,
        name: 'Test Rule',
        description: null,
        enabled: true,
        trigger_type: 'new_article',
        conditions,
        actions,
        priority: 0,
        match_count: 0,
        last_matched_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    return articles.map((article: Article) => {
        const matched = evaluateRuleConditions(testRule, article);
        return {
            article,
            would_match: matched,
            would_execute_actions: matched ? actions : [],
        };
    });
}

// DB row type for execution (JSON field is string)
interface RuleExecutionRow {
    id: number;
    rule_id: number;
    article_id: number;
    executed_at: string;
    success: boolean;
    actions_taken: string | null; // JSON string in DB
    error_message: string | null;
}

/**
 * Get rule execution history
 */
export function getRuleExecutions(ruleId: number, limit: number = 50): RuleExecution[] {
    const executions = query<RuleExecutionRow>(
        `SELECT * FROM rule_executions
         WHERE rule_id = ?
         ORDER BY executed_at DESC
         LIMIT ?`,
        [ruleId, limit]
    );

    return executions.map((exec: RuleExecutionRow) => ({
        ...exec,
        actions_taken: exec.actions_taken ? JSON.parse(exec.actions_taken) as RuleAction[] : [],
    }));
}

/**
 * Get rule statistics
 */
export function getRuleStats(ruleId: number): {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    last_execution: string | null;
} {
    const stats = queryOne<{
        total_executions: number;
        successful_executions: number;
        failed_executions: number;
        last_execution: string | null;
    }>(
        `SELECT
            COUNT(*) as total_executions,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_executions,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_executions,
            MAX(executed_at) as last_execution
         FROM rule_executions
         WHERE rule_id = ?`,
        [ruleId]
    );

    return stats || { total_executions: 0, successful_executions: 0, failed_executions: 0, last_execution: null };
}
