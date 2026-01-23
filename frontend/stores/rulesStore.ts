import { create } from 'zustand';
import { api } from '@/utils/api';

// ============================================================================
// TYPES
// ============================================================================

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

export interface RuleExecution {
    id: number;
    rule_id: number;
    article_id: number;
    executed_at: string;
    success: boolean;
    actions_taken: RuleAction[];
    error_message: string | null;
}

export interface RuleStats {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    last_execution: string | null;
}

export interface TestRuleResult {
    total_tested: number;
    match_count: number;
    results: {
        article_id: number;
        article_title: string;
        would_match: boolean;
        would_execute_actions: RuleAction[];
    }[];
}

// ============================================================================
// STORE
// ============================================================================

interface RulesState {
    rules: AutomationRule[];
    loading: boolean;
    error: string | null;

    // Fetchers
    fetchRules: (enabledOnly?: boolean) => Promise<void>;
    fetchRule: (ruleId: number) => Promise<AutomationRule | null>;

    // CRUD
    createRule: (data: {
        name: string;
        description?: string;
        trigger_type: AutomationRule['trigger_type'];
        conditions: RuleCondition[];
        actions: RuleAction[];
        priority?: number;
    }) => Promise<AutomationRule | null>;
    updateRule: (ruleId: number, updates: Partial<Pick<AutomationRule, 'name' | 'description' | 'enabled' | 'conditions' | 'actions' | 'priority'>>) => Promise<AutomationRule | null>;
    deleteRule: (ruleId: number) => Promise<boolean>;
    toggleRule: (ruleId: number, enabled: boolean) => Promise<AutomationRule | null>;

    // Testing & Analytics
    testRule: (conditions: RuleCondition[], actions: RuleAction[], limit?: number) => Promise<TestRuleResult | null>;
    getRuleExecutions: (ruleId: number, limit?: number) => Promise<RuleExecution[]>;
    getRuleStats: (ruleId: number) => Promise<RuleStats | null>;

    // Bulk operations
    bulkToggle: (ruleIds: number[], enabled: boolean) => Promise<boolean>;
    bulkDelete: (ruleIds: number[]) => Promise<boolean>;

    // Helpers
    clearError: () => void;
}

export const useRulesStore = create<RulesState>((set, get) => ({
    rules: [],
    loading: false,
    error: null,

    // ========================================================================
    // FETCHERS
    // ========================================================================

    fetchRules: async (enabledOnly = false) => {
        set({ loading: true, error: null });
        try {
            const response = await api.get<{ rules: AutomationRule[] }>(
                `/rules${enabledOnly ? '?enabled_only=true' : ''}`
            );
            set({ rules: response.rules, loading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch rules', loading: false });
        }
    },

    fetchRule: async (ruleId: number) => {
        set({ error: null });
        try {
            const response = await api.get<{ rule: AutomationRule }>(`/rules/${ruleId}`);
            return response.rule;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch rule' });
            return null;
        }
    },

    // ========================================================================
    // CRUD
    // ========================================================================

    createRule: async (data) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post<{ rule: AutomationRule }>('/rules', data);
            set((state) => ({
                rules: [...state.rules, response.rule],
                loading: false,
            }));
            return response.rule;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to create rule', loading: false });
            return null;
        }
    },

    updateRule: async (ruleId, updates) => {
        set({ loading: true, error: null });
        try {
            const response = await api.patch<{ rule: AutomationRule }>(`/rules/${ruleId}`, updates);
            set((state) => ({
                rules: state.rules.map((r) => (r.id === ruleId ? response.rule : r)),
                loading: false,
            }));
            return response.rule;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to update rule', loading: false });
            return null;
        }
    },

    deleteRule: async (ruleId) => {
        set({ loading: true, error: null });
        try {
            await api.delete(`/rules/${ruleId}`);
            set((state) => ({
                rules: state.rules.filter((r) => r.id !== ruleId),
                loading: false,
            }));
            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to delete rule', loading: false });
            return false;
        }
    },

    toggleRule: async (ruleId, enabled) => {
        set({ error: null });
        try {
            const response = await api.post<{ rule: AutomationRule }>(`/rules/${ruleId}/toggle`, { enabled });
            set((state) => ({
                rules: state.rules.map((r) => (r.id === ruleId ? response.rule : r)),
            }));
            return response.rule;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to toggle rule' });
            return null;
        }
    },

    // ========================================================================
    // TESTING & ANALYTICS
    // ========================================================================

    testRule: async (conditions, actions, limit = 10) => {
        set({ error: null });
        try {
            const response = await api.post<TestRuleResult>('/rules/test', {
                conditions,
                actions,
                limit,
            });
            return response;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to test rule' });
            return null;
        }
    },

    getRuleExecutions: async (ruleId, limit = 50) => {
        set({ error: null });
        try {
            const response = await api.get<{ executions: RuleExecution[] }>(
                `/rules/${ruleId}/executions${limit ? `?limit=${limit}` : ''}`
            );
            return response.executions;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch executions' });
            return [];
        }
    },

    getRuleStats: async (ruleId) => {
        set({ error: null });
        try {
            const response = await api.get<{ stats: RuleStats }>(`/rules/${ruleId}/stats`);
            return response.stats;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch stats' });
            return null;
        }
    },

    // ========================================================================
    // BULK OPERATIONS
    // ========================================================================

    bulkToggle: async (ruleIds, enabled) => {
        set({ loading: true, error: null });
        try {
            await api.post('/rules/bulk/toggle', { rule_ids: ruleIds, enabled });
            // Refetch rules to get updated state
            await get().fetchRules();
            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to toggle rules', loading: false });
            return false;
        }
    },

    bulkDelete: async (ruleIds) => {
        set({ loading: true, error: null });
        try {
            await api.post('/rules/bulk/delete', { rule_ids: ruleIds });
            set((state) => ({
                rules: state.rules.filter((r) => !ruleIds.includes(r.id)),
                loading: false,
            }));
            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to delete rules', loading: false });
            return false;
        }
    },

    // ========================================================================
    // HELPERS
    // ========================================================================

    clearError: () => set({ error: null }),
}));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format trigger type for display
 */
export function formatTriggerType(triggerType: AutomationRule['trigger_type']): string {
    const map: Record<AutomationRule['trigger_type'], string> = {
        new_article: 'New Article',
        keyword_match: 'Keyword Match',
        feed_match: 'Feed Match',
        author_match: 'Author Match',
    };
    return map[triggerType] || triggerType;
}

/**
 * Format operator for display
 */
export function formatOperator(operator: RuleCondition['operator']): string {
    const map: Record<RuleCondition['operator'], string> = {
        contains: 'Contains',
        not_contains: 'Does Not Contain',
        equals: 'Equals',
        not_equals: 'Does Not Equal',
        matches_regex: 'Matches Pattern',
        in: 'In List',
        not_in: 'Not In List',
    };
    return map[operator] || operator;
}

/**
 * Format field for display
 */
export function formatField(field: RuleCondition['field']): string {
    const map: Record<RuleCondition['field'], string> = {
        title: 'Title',
        content: 'Content',
        feed_id: 'Feed',
        author: 'Author',
        url: 'URL',
        type: 'Type',
        tags: 'Tags',
    };
    return map[field] || field;
}

/**
 * Format action type for display
 */
export function formatActionType(actionType: RuleAction['type']): string {
    const map: Record<RuleAction['type'], string> = {
        move_to_folder: 'Move to Folder',
        add_tag: 'Add Tag',
        mark_read: 'Mark as Read',
        bookmark: 'Bookmark',
        delete: 'Delete',
        notify: 'Send Notification',
    };
    return map[actionType] || actionType;
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: number): string {
    if (priority >= 75) return '#ef4444'; // High priority - red
    if (priority >= 50) return '#f59e0b'; // Medium priority - orange
    if (priority >= 25) return '#3b82f6'; // Normal priority - blue
    return '#6b7280'; // Low priority - gray
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
