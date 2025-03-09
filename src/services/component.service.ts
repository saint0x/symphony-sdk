import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { IComponentService } from '../types/interfaces';
import { ToolLifecycleState } from '../types/lifecycle';
import { ComponentMetadata, Component, ComponentInstance, ComponentCapability, ComponentRequirement } from '../types/metadata';
import { ComponentManager } from '../symphony/components/component-manager';

export class ComponentService extends BaseService implements IComponentService {
    constructor(symphony: ISymphony) {
        super(symphony, 'ComponentService');
        this._dependencies = ['ValidationService'];
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    async createComponent(name: string, config: any): Promise<Component> {
        return this.withErrorHandling('createComponent', async () => {
            this.assertInitialized();

            // Validate component config
            await this.symphony.validation.validate(config, 'component');

            // Create component metadata
            const metadata: ComponentMetadata = {
                id: `${name}_${Date.now()}`,
                name,
                description: config.description || `Component ${name}`,
                type: config.type || 'generic',
                version: config.version || '1.0.0',
                capabilities: config.capabilities?.map((cap: string): ComponentCapability => ({ 
                    name: cap,
                    description: `Capability ${cap}`
                })) || [],
                requirements: config.requirements?.map((req: string): ComponentRequirement => ({ 
                    capability: req,
                    optional: false
                })) || [],
                provides: config.provides || [],
                tags: config.tags || [],
                config: config
            };

            // Create component instance
            const instance: Component = {
                ...config,
                initialize: async () => {
                    // Component-specific initialization logic
                    if (config.initialize) {
                        await config.initialize();
                    }
                }
            };

            // Register with component manager
            const componentManager = ComponentManager.getInstance(this.symphony);
            await componentManager.register(metadata, instance);

            return instance;
        });
    }

    async getComponent(name: string): Promise<Component | undefined> {
        return this.withErrorHandling('getComponent', async () => {
            this.assertInitialized();
            
            // Find component by name in all components
            const componentManager = ComponentManager.getInstance(this.symphony);
            const components = componentManager.findComponents('*');
            const component = components.find((c: ComponentInstance) => c.metadata.name === name);
            return component?.instance;
        });
    }

    async listComponents(): Promise<string[]> {
        return this.withErrorHandling('listComponents', async () => {
            this.assertInitialized();
            
            // Get all components with any capability
            const componentManager = ComponentManager.getInstance(this.symphony);
            const components = componentManager.findComponents('*');
            return components.map((component: ComponentInstance) => component.metadata.name);
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing component service');
        this._state = ToolLifecycleState.READY;
    }
} 