import { Symphony } from './symphony/core/symphony';
import type { SymphonyConfig } from './symphony/interfaces/types';

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
                SymphonySDK.instance = Symphony.getInstance();
                if (config) {
                    SymphonySDK.instance.updateConfig(config);
                }
            } finally {
                SymphonySDK.isInitializing = false;
            }
        } else if (config) {
            SymphonySDK.instance.updateConfig(config);
        }

        if (!SymphonySDK.instance) {
            throw new Error('Failed to initialize Symphony instance');
        }

        return SymphonySDK.instance;
    }
}

// Create and export the default instance
export const symphony = SymphonySDK.getInstance({
    serviceRegistry: {
        enabled: false,
        maxRetries: 3,
        retryDelay: 1000
    },
    logging: {
        level: 'info',
        format: 'json'
    },
    metrics: {
        enabled: true,
        detailed: false
    }
});

// Export types and utilities
export * from './symphony/core/symphony';
export type { SymphonyConfig, ISymphony } from './symphony/interfaces/types';
export type * from './types/metadata';
export type * from './types/components';
export * from './types/capabilities'; 