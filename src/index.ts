import { Symphony } from './symphony/core/symphony';
import { SymphonyConfig } from './symphony/interfaces/types';

class SymphonySDK {
    private static instance: Symphony | null = null;
    private static isInitializing = false;

    static getInstance(config?: Partial<SymphonyConfig>): Symphony {
        if (SymphonySDK.isInitializing) {
            throw new Error('Symphony is already initializing. Avoid concurrent initialization.');
        }

        if (!SymphonySDK.instance) {
            SymphonySDK.isInitializing = true;
            try {
                SymphonySDK.instance = new Symphony(config);
            } finally {
                SymphonySDK.isInitializing = false;
            }
        } else if (config) {
            SymphonySDK.instance.updateConfig(config);
        }

        return SymphonySDK.instance;
    }
}

// Create and export the default instance
export const symphony = SymphonySDK.getInstance({
    serviceRegistry: { enabled: false },  // Disabled by default for simplicity
    logging: { level: 'info', format: 'json' },
    metrics: { enabled: true, detailed: false }
}); 