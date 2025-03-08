import { BaseManager } from './base';
import { Symphony } from '../symphony/core/symphony';
import { TeamConfig } from '../types/sdk';
import { ValidationManager } from './validation';

export class TeamManager extends BaseManager {
    private static instance: TeamManager;
    private validationManager: ValidationManager;

    private constructor(symphony: Symphony) {
        super(symphony, 'TeamManager');
        this.validationManager = ValidationManager.getInstance(symphony);
    }

    static getInstance(symphony: Symphony): TeamManager {
        if (!TeamManager.instance) {
            TeamManager.instance = new TeamManager(symphony);
        }
        return TeamManager.instance;
    }

    protected async initializeInternal(): Promise<void> {
        // Ensure validation manager is initialized
        await this.validationManager.initialize();
    }

    async createTeam(config: TeamConfig): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createTeam', async () => {
            // Validate configuration
            const validation = await this.validationManager.validate(config, 'TeamConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid team configuration: ${validation.errors.join(', ')}`);
            }

            // Get registry
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            // Create team
            const team = await registry.createTeam(config);
            this.logInfo(`Created team: ${config.name}`);
            
            return team;
        }, { teamName: config.name });
    }

    async getTeam(teamId: string): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('getTeam', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const team = await registry.getTeam(teamId);
            if (!team) {
                throw new Error(`Team not found: ${teamId}`);
            }

            return team;
        }, { teamId });
    }

    async listTeams(): Promise<any[]> {
        this.assertInitialized();
        return this.withErrorHandling('listTeams', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            return registry.listTeams();
        });
    }

    async deleteTeam(teamId: string): Promise<void> {
        this.assertInitialized();
        return this.withErrorHandling('deleteTeam', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await registry.deleteTeam(teamId);
            this.logInfo(`Deleted team: ${teamId}`);
        }, { teamId });
    }
} 