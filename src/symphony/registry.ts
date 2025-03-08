import { Logger, LogCategory } from '../utils/logger';
import { BaseManager } from '../managers/base';
import { ISymphony } from './interfaces/types';
import { TeamConfig } from '../types/sdk';

export interface ServiceInstance {
    id: string;
    capabilities: string[];
    status: 'pending' | 'ready' | 'error';
    lastError?: Error;
}

export class Registry extends BaseManager {
    private services = new Map<string, ServiceInstance>();
    private capabilities = new Map<string, Set<string>>();
    private teams = new Map<string, any>();
    private tools = new Map<string, any>();
    private agents = new Map<string, any>();
    private directories = new Map<string, any>();
    private logger: Logger;

    constructor(symphony: ISymphony) {
        super(symphony, 'Registry');
        this.logger = Logger.getInstance({ serviceContext: 'Registry' });
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
        
        this.logger.debug(LogCategory.SYSTEM, `Service registered: ${service.id}`, {
            metadata: {
                capabilities: service.capabilities,
                serviceId: service.id
            }
        });
    }

    findServicesByCapability(capability: string): ServiceInstance[] {
        // O(1) capability lookup
        const serviceIds = this.capabilities.get(capability) || new Set();
        return Array.from(serviceIds)
            .map(id => this.services.get(id)!)
            .filter(service => service.status === 'ready');
    }

    getService(id: string): ServiceInstance | undefined {
        return this.services.get(id);
    }

    updateServiceStatus(id: string, status: 'pending' | 'ready' | 'error', error?: Error): void {
        const service = this.services.get(id);
        if (service) {
            service.status = status;
            service.lastError = error;
            
            this.logger.debug(LogCategory.SYSTEM, `Service status updated: ${id}`, {
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
        
        this.logger.info(LogCategory.SYSTEM, 'Registry initialized');
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