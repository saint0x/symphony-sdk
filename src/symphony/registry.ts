import { LogCategory } from '../utils/logger';
import { BaseManager } from '../managers/base';
import { ISymphony } from '../types/symphony';
import { TeamConfig, ToolLifecycleState, HealthStatus, ToolStateEvent, ToolEventHandler } from '../types/sdk';

export interface ServiceInstance {
    id: string;
    capabilities: string[];
    status: ToolLifecycleState;
    lastError?: Error;
    health?: HealthStatus;
}

export class Registry extends BaseManager {
    private services = new Map<string, ServiceInstance>();
    private capabilities = new Map<string, Set<string>>();
    private stateIndex = new Map<ToolLifecycleState, Set<string>>();
    private dependencyGraph = new Map<string, Set<string>>();
    private reverseDependencies = new Map<string, Set<string>>();
    private healthStates = new Map<string, HealthStatus>();
    private stateSubscribers = new Map<string, Set<ToolEventHandler>>();
    private teams = new Map<string, any>();
    private tools = new Map<string, any>();
    private agents = new Map<string, any>();
    private directories = new Map<string, any>();

    constructor(symphony: ISymphony) {
        super(symphony, 'Registry');
        
        // Initialize state indexes
        Object.values(ToolLifecycleState).forEach(state => {
            this.stateIndex.set(state, new Set());
        });
    }

    registerService(service: ServiceInstance): void {
        // O(1) service registration
        this.services.set(service.id, service);
        
        // O(1) capability indexing
        service.capabilities.forEach(cap => {
            if (!this.capabilities.has(cap)) {
                this.capabilities.set(cap, new Set());
            }
            this.capabilities.get(cap)!.add(service.id);
        });

        // O(1) state indexing
        this.stateIndex.get(service.status)?.add(service.id);
        
        this.logInfo(`Service registered: ${service.id}`, {
            category: LogCategory.SYSTEM,
            metadata: {
                capabilities: service.capabilities,
                serviceId: service.id,
                status: service.status
            }
        });
    }

    updateServiceState(serviceId: string, newState: ToolLifecycleState, metadata?: Record<string, any>): void {
        const service = this.services.get(serviceId);
        if (!service) return;

        const previousState = service.status;
        
        // O(1) state index updates
        this.stateIndex.get(previousState)?.delete(serviceId);
        this.stateIndex.get(newState)?.add(serviceId);
        
        // Update service status
        service.status = newState;
        
        // Emit state change event
        const event: ToolStateEvent = {
            toolId: serviceId,
            previousState,
            newState,
            timestamp: Date.now(),
            metadata
        };

        // Notify subscribers - O(n) where n is number of subscribers for this service
        this.stateSubscribers.get(serviceId)?.forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                this.logError(`Error in state change handler for ${serviceId}`, {
                    category: LogCategory.SYSTEM,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    subscribeToStateChanges(serviceId: string, handler: ToolEventHandler): () => void {
        if (!this.stateSubscribers.has(serviceId)) {
            this.stateSubscribers.set(serviceId, new Set());
        }
        
        this.stateSubscribers.get(serviceId)!.add(handler);
        
        // Return unsubscribe function
        return () => {
            this.stateSubscribers.get(serviceId)?.delete(handler);
        };
    }

    updateHealthStatus(serviceId: string, health: HealthStatus): void {
        this.healthStates.set(serviceId, health);
        
        // Update service state based on health
        const newState = health.degraded ? ToolLifecycleState.DEGRADED : 
                        health.status === ToolLifecycleState.ERROR ? ToolLifecycleState.ERROR :
                        ToolLifecycleState.READY;
        
        this.updateServiceState(serviceId, newState, { healthUpdate: true });
    }

    registerDependency(serviceId: string, dependencyId: string): void {
        // O(1) dependency registration
        if (!this.dependencyGraph.has(serviceId)) {
            this.dependencyGraph.set(serviceId, new Set());
        }
        this.dependencyGraph.get(serviceId)!.add(dependencyId);

        // O(1) reverse dependency tracking
        if (!this.reverseDependencies.has(dependencyId)) {
            this.reverseDependencies.set(dependencyId, new Set());
        }
        this.reverseDependencies.get(dependencyId)!.add(serviceId);
    }

    getDependencies(serviceId: string): Set<string> {
        return this.dependencyGraph.get(serviceId) || new Set();
    }

    getDependents(serviceId: string): Set<string> {
        return this.reverseDependencies.get(serviceId) || new Set();
    }

    getServicesByState(state: ToolLifecycleState): Set<string> {
        return this.stateIndex.get(state) || new Set();
    }

    getHealthStatus(serviceId: string): HealthStatus | undefined {
        return this.healthStates.get(serviceId);
    }

    findServicesByCapability(capability: string): ServiceInstance[] {
        const serviceIds = this.capabilities.get(capability) || new Set();
        return Array.from(serviceIds)
            .map(id => this.services.get(id)!)
            .filter(service => service.status === ToolLifecycleState.READY);
    }

    getService(id: string): ServiceInstance | undefined {
        return this.services.get(id);
    }

    updateServiceStatus(id: string, status: ToolLifecycleState, error?: Error): void {
        const service = this.services.get(id);
        if (service) {
            service.status = status;
            service.lastError = error;
            
            this.getLogger().debug(LogCategory.SYSTEM, `Service status updated: ${id}`, {
                metadata: {
                    status,
                    serviceId: id,
                    error: error?.message
                }
            });
        }
    }

    protected async initializeInternal(): Promise<void> {
        // Clear existing registrations on initialization
        this.services.clear();
        this.capabilities.clear();
        
        this.getLogger().info(LogCategory.SYSTEM, 'Registry initialized');
    }

    // Team operations
    async createTeam(config: TeamConfig): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createTeam', async () => {
            const teamId = `team_${Date.now()}`;
            this.teams.set(teamId, { id: teamId, ...config });
            return this.teams.get(teamId);
        }, { teamName: config.name });
    }

    async getTeam(teamId: string): Promise<any | null> {
        this.assertInitialized();
        return this.withErrorHandling('getTeam', async () => {
            return this.teams.get(teamId) || null;
        }, { teamId });
    }

    async listTeams(): Promise<any[]> {
        this.assertInitialized();
        return this.withErrorHandling('listTeams', async () => {
            return Array.from(this.teams.values());
        });
    }

    async deleteTeam(teamId: string): Promise<void> {
        this.assertInitialized();
        return this.withErrorHandling('deleteTeam', async () => {
            this.teams.delete(teamId);
        }, { teamId });
    }

    // Tool operations
    registerTool(toolId: string, tool: any): void {
        this.assertInitialized();
        this.withErrorHandling('registerTool', async () => {
            this.tools.set(toolId, tool);
            this.logInfo(`Registered tool: ${toolId}`);
        }, { toolId });
    }

    getTool(toolId: string): any | null {
        this.assertInitialized();
        return this.tools.get(toolId) || null;
    }

    // Agent operations
    registerAgent(agentId: string, agent: any): void {
        this.assertInitialized();
        this.withErrorHandling('registerAgent', async () => {
            this.agents.set(agentId, agent);
            this.logInfo(`Registered agent: ${agentId}`);
        }, { agentId });
    }

    getAgent(agentId: string): any | null {
        this.assertInitialized();
        return this.agents.get(agentId) || null;
    }

    async listDirectory(path: string): Promise<string[]> {
        this.assertInitialized();
        return this.withErrorHandling('listDirectory', async () => {
            const normalizedPath = this.normalizePath(path);
            const dir = this.directories.get(normalizedPath);
            if (!dir) {
                return [];
            }
            return Object.keys(dir);
        }, { path });
    }

    async readDirectory(path: string): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('readDirectory', async () => {
            const normalizedPath = this.normalizePath(path);
            const dir = this.directories.get(normalizedPath);
            if (!dir) {
                throw new Error(`Directory not found: ${path}`);
            }
            return dir;
        }, { path });
    }

    async writeDirectory(path: string, contents: any): Promise<void> {
        this.assertInitialized();
        return this.withErrorHandling('writeDirectory', async () => {
            const normalizedPath = this.normalizePath(path);
            this.directories.set(normalizedPath, contents);
            this.logInfo(`Directory written: ${path}`, {
                metadata: {
                    path: normalizedPath,
                    size: JSON.stringify(contents).length
                }
            });
        }, { path });
    }

    async deleteDirectory(path: string): Promise<void> {
        this.assertInitialized();
        return this.withErrorHandling('deleteDirectory', async () => {
            const normalizedPath = this.normalizePath(path);
            if (this.directories.delete(normalizedPath)) {
                this.logInfo(`Directory deleted: ${path}`, {
                    metadata: { path: normalizedPath }
                });
            }
        }, { path });
    }

    private normalizePath(path: string): string {
        return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || '/';
    }
} 