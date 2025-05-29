import { readFileSync } from 'fs';
import { Logger } from '../utils/logger';
import { IDatabaseService, SessionContext } from '../db/types';

export interface ContextNode {
    id: string;
    type: 'tool' | 'workflow' | 'team' | 'task' | 'environment' | 'user_data';
    title: string;
    description?: string;
    timestamp?: Date;
    priority: number;
    children?: ContextNode[];
    metadata?: Record<string, any>;
    executionContext?: {
        toolName?: string;
        parameters?: Record<string, any>;
        result?: any;
        executionTime?: number;
        success?: boolean;
    };
    relationships?: {
        parentId?: string;
        relatedIds?: string[];
        dependencies?: string[];
    };
}

export interface ContextTree {
    sessionId: string;
    rootNodes: ContextNode[];
    totalNodes: number;
    lastUpdated: Date;
    contextDepth: number;
    metadata: {
        sessionStartTime: Date;
        totalToolExecutions: number;
        workflowsActive: number;
        userInteractions: number;
        averageResponseTime: number;
        primaryDomain?: string;
        learningAdaptations: number;
    };
}

export interface ContextQuery {
    sessionId?: string;
    nodeTypes?: string[];
    priority?: number;
    limit?: number;
    includeRelated?: boolean;
    timeWindow?: {
        start: Date;
        end: Date;
    };
    toolNames?: string[];
    keywords?: string[];
}

export class ContextTreeBuilder {
    private static instance: ContextTreeBuilder;
    private logger: Logger;
    private database: IDatabaseService;
    private baseContextTemplate: any;
    private initialized: boolean = false;
    private contextCache = new Map<string, ContextTree>();
    private maxCacheSize = 100;

    private constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('ContextTreeBuilder');
        this.database = database;
    }

    static getInstance(database: IDatabaseService): ContextTreeBuilder {
        if (!ContextTreeBuilder.instance) {
            ContextTreeBuilder.instance = new ContextTreeBuilder(database);
        }
        return ContextTreeBuilder.instance;
    }

    async initialize(contextTemplatePath?: string): Promise<void> {
        if (this.initialized) return;

        this.logger.info('ContextTreeBuilder', 'Initializing context tree builder');

        try {
            // Load base context template
            if (contextTemplatePath) {
                this.baseContextTemplate = JSON.parse(readFileSync(contextTemplatePath, 'utf-8'));
            } else {
                // Default minimal context structure
                this.baseContextTemplate = {
                    environment: {
                        userOS: 'unknown',
                        sessionType: 'interactive',
                        capabilities: []
                    },
                    session: {
                        state: 'active',
                        currentWorkflow: null
                    }
                };
            }

            this.initialized = true;
            this.logger.info('ContextTreeBuilder', 'Context tree builder initialized');
        } catch (error) {
            this.logger.error('ContextTreeBuilder', 'Failed to initialize', { error });
            throw error;
        }
    }

    async buildContextTree(sessionId: string, query?: ContextQuery): Promise<ContextTree> {
        this.logger.info('ContextTreeBuilder', 'Building context tree', { sessionId });

        try {
            // Check cache first
            const cacheKey = this.buildCacheKey(sessionId, query);
            if (this.contextCache.has(cacheKey)) {
                const cached = this.contextCache.get(cacheKey)!;
                
                // Check if cache is still fresh (within 5 minutes)
                if (Date.now() - cached.lastUpdated.getTime() < 5 * 60 * 1000) {
                    this.logger.debug('ContextTreeBuilder', 'Returning cached context tree', { sessionId });
                    return cached;
                }
            }

            // Build fresh context tree
            const contextTree = await this.buildFreshContextTree(sessionId, query);
            
            // Cache the result
            this.cacheContextTree(cacheKey, contextTree);
            
            return contextTree;
        } catch (error) {
            this.logger.error('ContextTreeBuilder', 'Failed to build context tree', { error, sessionId });
            throw error;
        }
    }

    private async buildFreshContextTree(sessionId: string, query?: ContextQuery): Promise<ContextTree> {
        const sessionContext = await this.database.getSessionContext(sessionId);
        const toolExecutions = await this.database.getToolExecutions(sessionId, query?.limit);
        const workflowExecutions = await this.database.getWorkflowExecutions(sessionId);

        // Build root nodes
        const rootNodes: ContextNode[] = [];
        let totalNodes = 0;

        // 1. Environment node (static + session data)
        const environmentNode = this.buildEnvironmentNode(sessionContext || undefined);
        rootNodes.push(environmentNode);
        totalNodes += 1 + (environmentNode.children?.length || 0);

        // 2. Active workflows node
        if (workflowExecutions.length > 0) {
            const workflowNode = this.buildWorkflowNode(workflowExecutions);
            rootNodes.push(workflowNode);
            totalNodes += 1 + (workflowNode.children?.length || 0);
        }

        // 3. Tool execution history
        if (toolExecutions.length > 0) {
            const toolNode = this.buildToolExecutionNode(toolExecutions, query);
            rootNodes.push(toolNode);
            totalNodes += 1 + (toolNode.children?.length || 0);
        }

        // 4. Session state and user data
        const sessionNode = this.buildSessionNode(sessionContext || undefined);
        rootNodes.push(sessionNode);
        totalNodes += 1 + (sessionNode.children?.length || 0);

        // 5. Learning adaptations and patterns
        const learningNode = await this.buildLearningNode(sessionId);
        if (learningNode.children && learningNode.children.length > 0) {
            rootNodes.push(learningNode);
            totalNodes += 1 + learningNode.children.length;
        }

        // Calculate metadata
        const metadata = this.calculateTreeMetadata(sessionContext || undefined, toolExecutions, workflowExecutions);

        return {
            sessionId,
            rootNodes,
            totalNodes,
            lastUpdated: new Date(),
            contextDepth: this.calculateMaxDepth(rootNodes),
            metadata
        };
    }

    private buildEnvironmentNode(sessionContext?: SessionContext): ContextNode {
        const environmentData = this.baseContextTemplate.environment || {};
        
        return {
            id: 'environment',
            type: 'environment',
            title: 'Environment Context',
            description: 'System and user environment information',
            priority: 10,
            metadata: {
                userOS: environmentData.userOS || 'unknown',
                sessionType: environmentData.sessionType || 'interactive',
                capabilities: environmentData.capabilities || [],
                workspaceRoot: sessionContext?.context_data?.workspaceRoot || '',
                currentShell: sessionContext?.context_data?.currentShell || ''
            },
            children: [
                {
                    id: 'environment.system',
                    type: 'environment',
                    title: 'System Information',
                    priority: 8,
                    metadata: {
                        os: environmentData.userOS,
                        shell: sessionContext?.context_data?.currentShell,
                        workspace: sessionContext?.context_data?.workspaceRoot
                    }
                },
                {
                    id: 'environment.capabilities',
                    type: 'environment', 
                    title: 'Available Capabilities',
                    priority: 7,
                    metadata: {
                        tools: environmentData.capabilities || [],
                        features: ['xml_patterns', 'context_trees', 'database_cache']
                    }
                }
            ]
        };
    }

    private buildWorkflowNode(workflowExecutions: any[]): ContextNode {
        const activeWorkflows = workflowExecutions.filter(w => w.status === 'running' || w.status === 'active');
        
        const children = workflowExecutions.slice(0, 10).map((workflow, _index) => ({
            id: `workflow.${workflow.workflow_id}`,
            type: 'workflow' as const,
            title: workflow.workflow_name || `Workflow ${workflow.workflow_id}`,
            description: workflow.description,
            timestamp: new Date(workflow.created_at),
            priority: workflow.status === 'running' ? 9 : 6,
            metadata: {
                status: workflow.status,
                progress: workflow.progress || 0,
                stepCount: workflow.step_count || 0,
                estimatedDuration: workflow.estimated_duration_ms
            }
        }));

        return {
            id: 'workflows',
            type: 'workflow',
            title: 'Active Workflows',
            description: `${activeWorkflows.length} active workflows, ${workflowExecutions.length} total`,
            priority: 9,
            children,
            metadata: {
                activeCount: activeWorkflows.length,
                totalCount: workflowExecutions.length
            }
        };
    }

    private buildToolExecutionNode(toolExecutions: any[], _query?: ContextQuery): ContextNode {
        // Prioritize recent and successful executions
        const sortedExecutions = toolExecutions
            .sort((a, b) => {
                const timeScore = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                const successScore = (b.success ? 100 : 0) - (a.success ? 100 : 0);
                return successScore + (timeScore / 1000000); // Time score scaled down
            })
            .slice(0, 15);

        const children = sortedExecutions.map((execution, index) => {
            const priority = this.calculateExecutionPriority(execution, index);
            
            return {
                id: `tool.${execution.execution_id}`,
                type: 'tool' as const,
                title: `${execution.tool_name}`,
                description: this.generateExecutionDescription(execution),
                timestamp: new Date(execution.created_at),
                priority,
                executionContext: {
                    toolName: execution.tool_name,
                    parameters: execution.parameters ? JSON.parse(execution.parameters) : {},
                    result: execution.result ? JSON.parse(execution.result) : null,
                    executionTime: execution.execution_time_ms,
                    success: execution.success
                },
                metadata: {
                    duration: execution.execution_time_ms,
                    success: execution.success,
                    retryCount: execution.retry_count || 0,
                    errorType: execution.error_message ? 'execution_error' : null
                }
            };
        });

        // Group similar tools
        const toolGroups = this.groupExecutionsByTool(children);
        const groupedChildren = Object.entries(toolGroups).map(([toolName, executions]) => ({
            id: `tool_group.${toolName}`,
            type: 'tool' as const,
            title: `${toolName} (${executions.length})`,
            description: `Recent ${toolName} executions`,
            priority: Math.max(...executions.map(e => e.priority)),
            children: executions.slice(0, 5), // Limit sub-items
            metadata: {
                toolName,
                executionCount: executions.length,
                successRate: executions.filter(e => e.executionContext?.success).length / executions.length
            }
        }));

        return {
            id: 'tool_executions',
            type: 'tool',
            title: 'Recent Tool Executions',
            description: `${toolExecutions.length} recent tool executions`,
            priority: 8,
            children: groupedChildren,
            metadata: {
                totalExecutions: toolExecutions.length,
                uniqueTools: new Set(toolExecutions.map(e => e.tool_name)).size,
                averageExecutionTime: toolExecutions.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / toolExecutions.length
            }
        };
    }

    private buildSessionNode(sessionContext?: SessionContext): ContextNode {
        const sessionData = sessionContext?.context_data || {};
        
        return {
            id: 'session',
            type: 'user_data',
            title: 'Session Context',
            description: 'Current session state and user data',
            priority: 7,
            metadata: {
                sessionId: sessionContext?.session_id,
                startTime: sessionContext?.started_at,
                lastActivity: sessionContext?.last_activity,
                interactionCount: sessionData.interactionCount || 0,
                currentTask: sessionData.currentTask,
                preferences: sessionData.preferences || {}
            },
            children: [
                {
                    id: 'session.preferences',
                    type: 'user_data',
                    title: 'User Preferences',
                    priority: 5,
                    metadata: sessionData.preferences || {}
                },
                {
                    id: 'session.current_task',
                    type: 'task',
                    title: 'Current Task Context',
                    priority: sessionData.currentTask ? 8 : 3,
                    metadata: {
                        task: sessionData.currentTask,
                        progress: sessionData.taskProgress || 0
                    }
                }
            ]
        };
    }

    private async buildLearningNode(_sessionId: string): Promise<ContextNode> {
        // Get recent pattern learning data
        const patterns = await this.database.getXMLPatterns(true);
        const recentPatterns = patterns
            .filter((p: any) => p.updated_at && new Date(p.updated_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
            .slice(0, 10);

        const children = recentPatterns.map((pattern: any) => ({
            id: `learning.${pattern.pattern_id}`,
            type: 'task' as const,
            title: `Pattern: ${pattern.pattern_name}`,
            description: `Confidence: ${(pattern.confidence_score * 100).toFixed(1)}%`,
            priority: Math.floor(pattern.confidence_score * 10),
            metadata: {
                patternId: pattern.pattern_id,
                confidence: pattern.confidence_score,
                successCount: pattern.success_count,
                failureCount: pattern.failure_count,
                toolName: pattern.tool_name
            }
        }));

        return {
            id: 'learning',
            type: 'task',
            title: 'Learning Adaptations',
            description: `${recentPatterns.length} recently adapted patterns`,
            priority: 6,
            children,
            metadata: {
                totalPatterns: patterns.length,
                adaptationsToday: recentPatterns.length,
                averageConfidence: recentPatterns.reduce((sum: number, p: any) => sum + p.confidence_score, 0) / (recentPatterns.length || 1)
            }
        };
    }

    private calculateExecutionPriority(execution: any, index: number): number {
        let priority = 5; // Base priority
        
        // Recent executions get higher priority
        const ageInMinutes = (Date.now() - new Date(execution.created_at).getTime()) / (1000 * 60);
        if (ageInMinutes < 5) priority += 3;
        else if (ageInMinutes < 30) priority += 2;
        else if (ageInMinutes < 120) priority += 1;

        // Successful executions get bonus
        if (execution.success) priority += 2;
        
        // Fast executions get slight bonus
        if (execution.execution_time_ms && execution.execution_time_ms < 1000) priority += 1;

        // Position in list affects priority
        priority -= Math.floor(index / 3);

        return Math.max(1, Math.min(10, priority));
    }

    private generateExecutionDescription(execution: any): string {
        const duration = execution.execution_time_ms ? `${execution.execution_time_ms}ms` : 'unknown duration';
        const status = execution.success ? '✓' : '✗';
        
        let paramDesc = '';
        if (execution.parameters) {
            try {
                const params = JSON.parse(execution.parameters);
                const keys = Object.keys(params);
                if (keys.length > 0) {
                    paramDesc = ` with ${keys.slice(0, 2).join(', ')}`;
                    if (keys.length > 2) paramDesc += `, +${keys.length - 2} more`;
                }
            } catch {
                // Ignore parsing errors
            }
        }

        return `${status} Executed in ${duration}${paramDesc}`;
    }

    private groupExecutionsByTool(executions: ContextNode[]): Record<string, ContextNode[]> {
        const groups: Record<string, ContextNode[]> = {};
        
        for (const execution of executions) {
            const toolName = execution.executionContext?.toolName || 'unknown';
            if (!groups[toolName]) {
                groups[toolName] = [];
            }
            groups[toolName].push(execution);
        }

        return groups;
    }

    private calculateMaxDepth(nodes: ContextNode[]): number {
        let maxDepth = 1;
        
        for (const node of nodes) {
            if (node.children && node.children.length > 0) {
                const childDepth = 1 + this.calculateMaxDepth(node.children);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        }

        return maxDepth;
    }

    private calculateTreeMetadata(
        sessionContext?: SessionContext,
        toolExecutions: any[] = [],
        workflowExecutions: any[] = []
    ) {
        const now = Date.now();
        const sessionStart = sessionContext?.started_at ? new Date(sessionContext.started_at).getTime() : now;
        
        // Calculate average response time from recent executions
        const recentExecutions = toolExecutions.filter(e => 
            e.execution_time_ms && (now - new Date(e.created_at).getTime()) < 60 * 60 * 1000
        );
        const averageResponseTime = recentExecutions.length > 0 
            ? recentExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0) / recentExecutions.length
            : 0;

        // Determine primary domain from tool usage
        const toolCounts: Record<string, number> = {};
        toolExecutions.forEach(e => {
            toolCounts[e.tool_name] = (toolCounts[e.tool_name] || 0) + 1;
        });
        const primaryTool = Object.entries(toolCounts).sort(([,a], [,b]) => b - a)[0]?.[0];
        
        return {
            sessionStartTime: new Date(sessionStart),
            totalToolExecutions: toolExecutions.length,
            workflowsActive: workflowExecutions.filter(w => w.status === 'running').length,
            userInteractions: sessionContext?.context_data?.interactionCount || 0,
            averageResponseTime,
            primaryDomain: this.mapToolToDomain(primaryTool),
            learningAdaptations: 0 // Will be filled by learning node if present
        };
    }

    private mapToolToDomain(toolName?: string): string | undefined {
        if (!toolName) return undefined;
        
        const domainMap: Record<string, string> = {
            'web_search': 'research',
            'file_search': 'development',
            'edit_file': 'development',
            'run_terminal_cmd': 'system_admin',
            'codebase_search': 'development',
            'list_dir': 'file_management'
        };

        return domainMap[toolName] || 'general';
    }

    private buildCacheKey(sessionId: string, query?: ContextQuery): string {
        const queryHash = query ? JSON.stringify(query) : 'default';
        return `${sessionId}:${queryHash}`;
    }

    private cacheContextTree(key: string, tree: ContextTree): void {
        // Implement LRU cache
        if (this.contextCache.size >= this.maxCacheSize) {
            const firstKey = this.contextCache.keys().next().value;
            if (firstKey) {
                this.contextCache.delete(firstKey);
            }
        }
        
        this.contextCache.set(key, tree);
        this.logger.debug('ContextTreeBuilder', 'Cached context tree', { 
            key: key.substring(0, 20) + '...', 
            nodes: tree.totalNodes 
        });
    }

    async getContextForPrompt(sessionId: string, options?: {
        maxNodes?: number;
        includeLowPriority?: boolean;
        focusAreas?: string[];
    }): Promise<string> {
        const tree = await this.buildContextTree(sessionId);
        
        // Convert tree to prompt-friendly format
        const maxNodes = options?.maxNodes || 50;
        const includeLowPriority = options?.includeLowPriority || false;
        const minPriority = includeLowPriority ? 1 : 5;

        const relevantNodes = this.flattenTree(tree.rootNodes)
            .filter(node => node.priority >= minPriority)
            .sort((a, b) => b.priority - a.priority)
            .slice(0, maxNodes);

        return this.formatNodesForPrompt(relevantNodes, tree.metadata);
    }

    private flattenTree(nodes: ContextNode[], depth = 0): ContextNode[] {
        const flattened: ContextNode[] = [];
        
        for (const node of nodes) {
            flattened.push({ ...node, metadata: { ...node.metadata, depth } });
            
            if (node.children && node.children.length > 0) {
                flattened.push(...this.flattenTree(node.children, depth + 1));
            }
        }

        return flattened;
    }

    private formatNodesForPrompt(nodes: ContextNode[], metadata: any): string {
        const sections: string[] = [];
        
        // Add session overview
        sections.push(`**Session Context** (${metadata.totalToolExecutions} tools, ${metadata.userInteractions} interactions)`);
        
        // Group nodes by type
        const nodesByType = nodes.reduce((groups, node) => {
            if (!groups[node.type]) groups[node.type] = [];
            groups[node.type].push(node);
            return groups;
        }, {} as Record<string, ContextNode[]>);

        // Format each type
        for (const [type, typeNodes] of Object.entries(nodesByType)) {
            if (typeNodes.length === 0) continue;
            
            sections.push(`\n**${type.toUpperCase()}:**`);
            
            typeNodes.slice(0, 10).forEach(node => {
                const indent = '  '.repeat((node.metadata?.depth || 0));
                const priority = node.priority >= 8 ? '🔥' : node.priority >= 6 ? '⭐' : '';
                sections.push(`${indent}- ${priority} ${node.title}: ${node.description || ''}`);
            });
        }

        return sections.join('\n');
    }

    clearCache(): void {
        this.contextCache.clear();
        this.logger.info('ContextTreeBuilder', 'Cleared context cache');
    }

    getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.contextCache.size,
            maxSize: this.maxCacheSize
        };
    }
} 