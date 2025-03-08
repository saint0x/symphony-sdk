import { BaseManager } from '../managers/base';
import { Symphony } from './core/symphony';
import { TeamConfig } from '../types/sdk';

export class Registry extends BaseManager {
    private teams: Map<string, any>;
    private tools: Map<string, any>;
    private agents: Map<string, any>;

    constructor(symphony: Symphony) {
        super(symphony, 'Registry');
        this.teams = new Map();
        this.tools = new Map();
        this.agents = new Map();
    }

    protected async initializeInternal(): Promise<void> {
        // Initialize storage
        this.teams.clear();
        this.tools.clear();
        this.agents.clear();
        
        this.logInfo('Storage initialized');
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
} 