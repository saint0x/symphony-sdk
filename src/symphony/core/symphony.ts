import { ServiceRegistry } from '../../proto/symphonic/core/types';
import { logger, LogCategory } from '../../utils/logger';
import { globalMetrics } from '../../utils/metrics';
import { validateConfig } from '../../utils/validation';
import { ISymphony, SymphonyUtils } from '../interfaces/types';
import { ToolService } from '../services/tool';
import { AgentService } from '../services/agent';
import { TeamService } from '../services/team';
import { PipelineService } from '../services/pipeline';

export class Symphony implements ISymphony {
    private registry: ServiceRegistry | null = null;
    private initialized = false;
    metrics: typeof globalMetrics = globalMetrics;
    startTime: number = Date.now();
    utils: SymphonyUtils;

    public tools: ToolService;
    public agent: AgentService;
    public team: TeamService;
    public pipeline: PipelineService;

    constructor() {
        // Start SDK metrics
        globalMetrics.start('sdk_lifecycle', {
            startTime: Date.now(),
            version: '0.1.0'
        });

        this.utils = {
            metrics: globalMetrics,
            logger: logger,
            validation: {
                validateConfig,
                validateInput: validateConfig,
                validateOutput: validateConfig
            }
        };

        // Initialize services
        this.tools = new ToolService(this);
        this.agent = new AgentService(this);
        this.team = new TeamService(this);
        this.pipeline = new PipelineService(this);
    }

    private async ensureInitialized(): Promise<ServiceRegistry> {
        if (!this.initialized) {
            logger.debug(LogCategory.SYSTEM, 'Initializing ServiceRegistry for SDK');
            const registry = await ServiceRegistry.getInstance();
            if (!registry) {
                throw new Error('Failed to initialize ServiceRegistry');
            }
            this.registry = registry;
            await this.tools.initializeStandardTools();
            this.initialized = true;
            logger.info(LogCategory.SYSTEM, 'SDK ServiceRegistry initialized');
        }
        
        if (!this.registry) {
            throw new Error('ServiceRegistry not available');
        }
        return this.registry;
    }

    async getRegistry(): Promise<ServiceRegistry> {
        return this.ensureInitialized();
    }
} 