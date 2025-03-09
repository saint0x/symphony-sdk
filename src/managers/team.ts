import { ISymphony } from '../types/symphony';
import { BaseManager } from './base';
import { Team, TeamConfig, ToolLifecycleState } from '../types/sdk';
import { ValidationManager } from './validation';
import { ITeamService } from '../types/interfaces';

export class TeamManager extends BaseManager implements ITeamService {
    private static instance: TeamManager;
    private validationManager: ValidationManager;
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;

    protected constructor(symphony: ISymphony) {
        super(symphony, 'TeamManager');
        this.validationManager = ValidationManager.getInstance(symphony);
        // Add dependencies
        if (this.validationManager instanceof BaseManager) {
            this.addDependency(this.validationManager);
        }
    }

    static getInstance(symphony: ISymphony): TeamManager {
        if (!TeamManager.instance) {
            TeamManager.instance = new TeamManager(symphony);
        }
        return TeamManager.instance;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ValidationManager'];
    }

    protected async initializeInternal(): Promise<void> {
        this._state = ToolLifecycleState.READY;
    }

    async createTeam(name: string, config: TeamConfig): Promise<Team> {
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
            const result = await registry.executeCall('team', 'create', { name, config });
            if (!result || typeof result !== 'object') {
                throw new Error('Invalid team result from registry');
            }

            // Validate team structure
            const team = result as unknown as Team;
            if (!team.name || !team.agents || typeof team.run !== 'function') {
                throw new Error('Invalid team data returned from registry');
            }

            this.logInfo(`Created team: ${name}`, { teamName: name });
            return team;
        }, { teamName: name });
    }

    async getTeam(name: string): Promise<Team> {
        this.assertInitialized();
        return this.withErrorHandling('getTeam', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const result = await registry.executeCall('team', 'get', { name });
            if (!result) {
                throw new Error(`Team not found: ${name}`);
            }

            // Validate team structure
            const team = result as unknown as Team;
            if (!team.name || !team.agents || typeof team.run !== 'function') {
                throw new Error(`Invalid team data for: ${name}`);
            }

            return team;
        }, { teamName: name });
    }

    async listTeams(): Promise<string[]> {
        this.assertInitialized();
        return this.withErrorHandling('listTeams', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const result = await registry.executeCall('team', 'list', {});
            if (!Array.isArray(result)) {
                throw new Error('Invalid team list result from registry');
            }

            return result;
        });
    }

    async deleteTeam(name: string): Promise<void> {
        this.assertInitialized();
        return this.withErrorHandling('deleteTeam', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await registry.executeCall('team', 'delete', { name });
            this.logInfo(`Deleted team: ${name}`);
        }, { teamName: name });
    }
} 