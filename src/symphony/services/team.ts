import { TeamConfig } from '../../types/sdk';
import { ISymphony } from '../../types/symphony';
import { BaseManager } from '../../managers/base';
import { ITeamService } from '../../services/interfaces';
import { ToolLifecycleState } from '../../types/sdk';
import { ServiceConfig } from '../../proto/symphonic/core/types';

interface TeamInstance {
    name: string;
    description: string;
    agents: string[];
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
}

export class TeamService extends BaseManager implements ITeamService {
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private teams = new Map<string, TeamInstance>();

    constructor(symphony: ISymphony) {
        super(symphony as any, 'TeamService');
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this._state = ToolLifecycleState.READY;
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    async createTeam(name: string, config: TeamConfig): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createTeam', async () => {
            const validation = await this.symphony.validation.validate(config, 'TeamConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid team configuration: ${validation.errors.join(', ')}`);
            }

            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const team: TeamInstance = {
                name,
                description: config.description,
                agents: config.agents.map(agent => typeof agent === 'string' ? agent : agent.name),
                status: 'ACTIVE'
            };

            // Register the team as a service
            registry.registerService({
                metadata: {
                    id: name,
                    name,
                    version: '1.0.0',
                    type: 'TEAM',
                    status: 'ACTIVE',
                    description: config.description,
                    customMetadata: config
                },
                methods: {
                    run: async (params: any) => {
                        // Team execution logic here
                        return { success: true, data: params };
                    }
                }
            } as ServiceConfig);

            this.teams.set(name, team);
            this.logInfo(`Created team: ${name}`);
            return team;
        }, { teamName: name });
    }

    async getTeam(name: string): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('getTeam', async () => {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const service = await registry.getService(name);
            if (!service || service.metadata.type !== 'TEAM') {
                throw new Error(`Team ${name} not found`);
            }

            const team = this.teams.get(name) || {
                name: service.metadata.name,
                description: service.metadata.description || '',
                agents: [],
                status: service.metadata.status
            };

            return team;
        }, { teamName: name });
    }

    async listTeams(): Promise<string[]> {
        this.assertInitialized();
        return this.withErrorHandling('listTeams', async () => {
            return Array.from(this.teams.keys());
        });
    }

    getDependencies(): string[] {
        return [];
    }
} 