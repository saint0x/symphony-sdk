import { TeamConfig } from '../../types/sdk';
import { Symphony } from '../core/symphony';
import { validationManager } from '../../utils/validation';

export class TeamService {
    constructor(private symphony: Symphony) {}

    async create(config: TeamConfig): Promise<any> {
        // Validate configuration using the new validation system
        const validation = validationManager.validate(config, 'TeamConfig');

        if (!validation.isValid) {
            throw new Error(`Invalid team configuration: ${validation.errors.join(', ')}`);
        }

        // Start team creation metrics
        const metricId = `team_create_${config.name}`;
        this.symphony.metrics.start(metricId, { teamName: config.name });

        try {
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }
            const team = await registry.createTeam(config);
            
            this.symphony.metrics.end(metricId, { success: true });
            return team;
        } catch (error) {
            this.symphony.metrics.end(metricId, { success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
} 