import { PipelineConfig } from '../../types/sdk';
import { Symphony } from '../core/symphony';
import { validateConfig } from '../../utils/validation';

export class PipelineService {
    constructor(private symphony: Symphony) {}

    async create(config: PipelineConfig): Promise<any> {
        // Validate configuration
        const validation = validateConfig(config, {
            name: { type: 'string', required: true },
            description: { type: 'string', required: true },
            steps: { type: 'array', required: true }
        });

        if (!validation.isValid) {
            throw new Error(`Invalid pipeline configuration: ${validation.errors.join(', ')}`);
        }

        // Start pipeline creation metrics
        const metricId = `pipeline_create_${config.name}`;
        this.symphony.metrics.start(metricId, { pipelineName: config.name });

        try {
            const registry = await this.symphony.getRegistry();
            const pipeline = await registry.createPipeline(config);
            
            this.symphony.metrics.end(metricId, { success: true });
            return pipeline;
        } catch (error) {
            this.symphony.metrics.end(metricId, { success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
} 