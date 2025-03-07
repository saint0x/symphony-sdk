import { logger, LogCategory } from '../../../../utils/logger';

export interface ContextNode {
    id: string;
    type: 'SERVICE' | 'EXECUTION' | 'ERROR';
    timestamp: string;
    metadata: Record<string, any>;
    parent?: string;
    children: string[];
}

export interface ContextEvent {
    type: string;
    serviceId: string;
    timestamp: string;
    metadata: any;
}

export class ContextManager {
    private static instance: ContextManager;
    private nodes: Map<string, ContextNode>;
    private serviceContexts: Map<string, string>; // serviceId -> nodeId
    private maxNodes: number;

    private constructor() {
        this.nodes = new Map();
        this.serviceContexts = new Map();
        this.maxNodes = 1000; // Default limit
        this.initializeRoot();
        logger.info(LogCategory.CACHE, 'ContextManager instance created');
    }

    private initializeRoot(): void {
        const rootNode: ContextNode = {
            id: 'root',
            type: 'SERVICE',
            timestamp: new Date().toISOString(),
            metadata: {
                name: 'Root Context',
                description: 'Root node of the context tree'
            },
            children: []
        };
        this.nodes.set('root', rootNode);
        logger.debug(LogCategory.CACHE, 'Root context node initialized');
    }

    public static getInstance(): ContextManager {
        if (!ContextManager.instance) {
            ContextManager.instance = new ContextManager();
        }
        return ContextManager.instance;
    }

    public async updateServiceContext(event: ContextEvent): Promise<void> {
        try {
            logger.debug(LogCategory.CACHE, 'Updating service context', {
                metadata: {
                    serviceId: event.serviceId,
                    eventType: event.type
                }
            });

            const nodeId = `${event.serviceId}_${Date.now()}`;
            const contextNode: ContextNode = {
                id: nodeId,
                type: 'SERVICE',
                timestamp: event.timestamp,
                metadata: event.metadata,
                children: []
            };

            // Get current context for the service
            const currentContextId = this.serviceContexts.get(event.serviceId);
            if (currentContextId) {
                const currentNode = this.nodes.get(currentContextId);
                if (currentNode) {
                    contextNode.parent = currentContextId;
                    currentNode.children.push(nodeId);
                }
            } else {
                // Link to root if no existing context
                contextNode.parent = 'root';
                const rootNode = this.nodes.get('root');
                if (rootNode) {
                    rootNode.children.push(nodeId);
                }
            }

            this.nodes.set(nodeId, contextNode);
            this.serviceContexts.set(event.serviceId, nodeId);

            // Prune old nodes if necessary
            await this.pruneOldNodes();

            logger.debug(LogCategory.CACHE, 'Service context updated', {
                metadata: {
                    nodeId,
                    parentId: contextNode.parent
                }
            });
        } catch (error: any) {
            logger.error(LogCategory.CACHE, 'Failed to update service context', {
                metadata: {
                    serviceId: event.serviceId,
                    error: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    public async recordExecutionContext(
        serviceId: string,
        executionId: string,
        metadata: any
    ): Promise<void> {
        try {
            const nodeId = `exec_${executionId}`;
            const contextNode: ContextNode = {
                id: nodeId,
                type: 'EXECUTION',
                timestamp: new Date().toISOString(),
                metadata,
                children: []
            };

            const serviceContextId = this.serviceContexts.get(serviceId);
            if (serviceContextId) {
                const serviceNode = this.nodes.get(serviceContextId);
                if (serviceNode) {
                    contextNode.parent = serviceContextId;
                    serviceNode.children.push(nodeId);
                }
            }

            this.nodes.set(nodeId, contextNode);
            await this.pruneOldNodes();

            logger.debug(LogCategory.CACHE, 'Execution context recorded', {
                metadata: {
                    serviceId,
                    executionId,
                    nodeId
                }
            });
        } catch (error: any) {
            logger.error(LogCategory.CACHE, 'Failed to record execution context', {
                metadata: {
                    serviceId,
                    executionId,
                    error: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    public async recordErrorContext(
        serviceId: string,
        error: Error,
        metadata: any
    ): Promise<void> {
        try {
            const nodeId = `error_${Date.now()}`;
            const contextNode: ContextNode = {
                id: nodeId,
                type: 'ERROR',
                timestamp: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                },
                children: []
            };

            const serviceContextId = this.serviceContexts.get(serviceId);
            if (serviceContextId) {
                const serviceNode = this.nodes.get(serviceContextId);
                if (serviceNode) {
                    contextNode.parent = serviceContextId;
                    serviceNode.children.push(nodeId);
                }
            }

            this.nodes.set(nodeId, contextNode);
            await this.pruneOldNodes();

            logger.debug(LogCategory.CACHE, 'Error context recorded', {
                metadata: {
                    serviceId,
                    nodeId,
                    errorMessage: error.message
                }
            });
        } catch (error: any) {
            logger.error(LogCategory.CACHE, 'Failed to record error context', {
                metadata: {
                    serviceId,
                    error: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    public getServiceContext(serviceId: string): ContextNode | undefined {
        const contextId = this.serviceContexts.get(serviceId);
        if (contextId) {
            return this.nodes.get(contextId);
        }
        return undefined;
    }

    public getContextNode(nodeId: string): ContextNode | undefined {
        return this.nodes.get(nodeId);
    }

    public getContextPath(nodeId: string): ContextNode[] {
        const path: ContextNode[] = [];
        let currentNode = this.nodes.get(nodeId);

        while (currentNode) {
            path.unshift(currentNode);
            if (currentNode.parent) {
                currentNode = this.nodes.get(currentNode.parent);
            } else {
                break;
            }
        }

        return path;
    }

    private async pruneOldNodes(): Promise<void> {
        if (this.nodes.size <= this.maxNodes) {
            return;
        }

        const nodes = Array.from(this.nodes.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const nodesToRemove = nodes.slice(this.maxNodes);
        for (const node of nodesToRemove) {
            this.nodes.delete(node.id);
            // Update parent's children list
            if (node.parent) {
                const parent = this.nodes.get(node.parent);
                if (parent) {
                    parent.children = parent.children.filter(id => id !== node.id);
                }
            }
        }

        logger.debug(LogCategory.CACHE, 'Old context nodes pruned', {
            metadata: {
                removedCount: nodesToRemove.length,
                remainingCount: this.nodes.size
            }
        });
    }

    public setMaxNodes(limit: number): void {
        this.maxNodes = limit;
        logger.debug(LogCategory.CACHE, 'Max nodes limit updated', {
            metadata: {
                limit
            }
        });
    }

    public getContextSummary(): any {
        const summary = {
            totalNodes: this.nodes.size,
            serviceContexts: this.serviceContexts.size,
            nodeTypes: {
                SERVICE: 0,
                EXECUTION: 0,
                ERROR: 0
            } as Record<ContextNode['type'], number>,
            recentActivity: [] as any[]
        };

        // Count node types
        for (const node of this.nodes.values()) {
            summary.nodeTypes[node.type]++;
        }

        // Get recent activity
        const recentNodes = Array.from(this.nodes.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);

        summary.recentActivity = recentNodes.map(node => ({
            id: node.id,
            type: node.type,
            timestamp: node.timestamp,
            metadata: node.metadata
        }));

        return summary;
    }
} 