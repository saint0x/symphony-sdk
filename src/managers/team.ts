import { ISymphony } from '../symphony/interfaces/types';
import { BaseManager } from './base';
import { TeamConfig } from '../types/sdk';
import { ValidationManager } from './validation';
import { ITeamService } from '../services/interfaces';

export class TeamManager extends BaseManager implements ITeamService {
    private static instance: TeamManager;
    private validationManager: ValidationManager;

    protected constructor(symphony: ISymphony) {
        super(symphony, 'TeamManager');
        this.validationManager = ValidationManager.getInstance(symphony);
        // Add dependencies
        this.addDependency(symphony.validation);
        this.addDependency(symphony.components);
        this.addDependency(symphony.tools);
        this.addDependency(symphony.agent);
    }

    static getInstance(symphony: ISymphony): TeamManager {
        if (!TeamManager.instance) {
            TeamManager.instance = new TeamManager(symphony);
        }
        return TeamManager.instance;
    }

    protected async initializeInternal(): Promise<void> {
        // No additional initialization needed
    }

    async create(config: TeamConfig): Promise<any> {
        return this.createTeam(config);
    }

    private async createTeam(config: TeamConfig): Promise<any> {
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
            this.logInfo(`Created team: ${config.name}`, { teamName: config.name });
            
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