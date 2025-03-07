import { TeamConfig } from '../../types/sdk';
import { Symphony } from '../core/symphony';
import { validateConfig } from '../../utils/validation';

export class TeamService {
    constructor(private symphony: Symphony) {}

    async create(config: TeamConfig): Promise<any> {
        // Validate configuration
        const validation = validateConfig(config, {
            name: { type: 'string', required: true },
            description: { type: 'string', required: true },
            agents: { type: 'array', required: true }
        });

        if (!validation.isValid) {
            throw new Error(`Invalid team configuration: ${validation.errors.join(', ')}`);
        }

        // Start team creation metrics
        const metricId = `team_create_${config.name}`;
        this.symphony.metrics.start(metricId, { teamName: config.name });

        try {
            const registry = await this.symphony.getRegistry();
            const team = await registry.createTeam(config);
            
            this.symphony.metrics.end(metricId, { success: true });
            return team;
        } catch (error) {
            this.symphony.metrics.end(metricId, { success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
} 