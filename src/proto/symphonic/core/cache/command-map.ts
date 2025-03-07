import { logger, LogCategory } from '../../../../utils/logger';

// Pattern types
export interface ToolPattern {
    id: string;
    confidence: number;
    trigger: string;
    variables: string[];
    service: {
        name: string;
        method: string;
    };
    usageStats: {
        totalCalls: number;
        successfulCalls: number;
        lastUsed: number;
    };
}

export interface ToolMatch {
    pattern: ToolPattern;
    variables: Record<string, string>;
    confidence: number;
}

export interface CommandPattern {
    id: string;
    linguisticPattern: string;
    variables: Array<{
        name: string;
        position: number;
        type: string;
        description: string;
    }>;
    toolMapping: {
        tool: string;
        parameters: Record<string, string>;
    };
    confidence: number;
    usageStats: {
        totalCalls: number;
        successfulCalls: number;
        lastUsed: number;
        averageLatency: number;
    };
}

export interface PatternMatch {
    pattern: CommandPattern;
    variables: Record<string, string>;
    confidence: number;
}

// Command Map manager
export class CommandMap {
    private static instance: CommandMap | null = null;
    private toolPatterns: Map<string, ToolPattern> = new Map();
    private commandPatterns: Map<string, CommandPattern> = new Map();

    private constructor() {
        logger.info(LogCategory.CACHE, 'CommandMap instance created');
    }

    static getInstance(): CommandMap {
        if (!CommandMap.instance) {
            CommandMap.instance = new CommandMap();
        }
        return CommandMap.instance;
    }

    // Tool pattern methods
    async findToolMatch(llmQuery: string): Promise<ToolMatch | null> {
        logger.debug(LogCategory.CACHE, 'Finding tool match', {
            metadata: {
                query: llmQuery,
                patternCount: this.toolPatterns.size
            }
        });

        let bestMatch: ToolMatch | null = null;
        let highestConfidence = 0;

        for (const pattern of this.toolPatterns.values()) {
            const match = await this.matchToolPattern(pattern, llmQuery);
            if (match && match.confidence > highestConfidence) {
                bestMatch = match;
                highestConfidence = match.confidence;
            }
        }

        if (bestMatch) {
            logger.info(LogCategory.CACHE, 'Tool match found', {
                metadata: {
                    patternId: bestMatch.pattern.id,
                    confidence: bestMatch.confidence,
                    variables: bestMatch.variables
                }
            });
        } else {
            logger.info(LogCategory.CACHE, 'No tool match found', {
                metadata: {
                    query: llmQuery
                }
            });
        }

        return bestMatch;
    }

    private async matchToolPattern(pattern: ToolPattern, query: string): Promise<ToolMatch | null> {
        try {
            const regexStr = pattern.trigger.replace(/\*/g, '(.+)');
            const regex = new RegExp(`^${regexStr}$`, 'i');
            const match = query.match(regex);

            if (!match) return null;

            const variables: Record<string, string> = {};
            pattern.variables.forEach((varName, index) => {
                variables[varName] = match[index + 1];
            });

            const successRate = pattern.usageStats.successfulCalls / Math.max(1, pattern.usageStats.totalCalls);
            const staticParts = pattern.trigger.split('*').length - 1;
            const specificity = staticParts / pattern.trigger.length;

            const confidence = pattern.confidence * successRate * specificity;

            return {
                pattern,
                variables,
                confidence
            };
        } catch (error: any) {
            logger.error(LogCategory.CACHE, 'Error matching pattern', {
                metadata: {
                    patternId: pattern.id,
                    error: error.message,
                    query
                }
            });
            return null;
        }
    }

    async addToolPattern(pattern: ToolPattern): Promise<void> {
        logger.debug(LogCategory.CACHE, 'Adding tool pattern', {
            metadata: {
                id: pattern.id,
                trigger: pattern.trigger
            }
        });

        if (this.toolPatterns.has(pattern.id)) {
            throw new Error(`Pattern with ID ${pattern.id} already exists`);
        }

        if (!await this.validateToolPattern(pattern)) {
            throw new Error(`Invalid pattern: ${pattern.id}`);
        }

        this.toolPatterns.set(pattern.id, {
            ...pattern,
            usageStats: {
                totalCalls: 0,
                successfulCalls: 0,
                lastUsed: Date.now()
            }
        });

        logger.info(LogCategory.CACHE, 'Tool pattern added successfully', {
            metadata: {
                id: pattern.id,
                variables: pattern.variables
            }
        });
    }

    // Command pattern methods
    findCommandMatch(query: string): PatternMatch | null {
        logger.debug(LogCategory.CACHE, 'Finding command match', {
            metadata: {
                query,
                patternCount: this.commandPatterns.size
            }
        });

        let bestMatch: PatternMatch | null = null;
        let highestConfidence = 0;

        for (const pattern of this.commandPatterns.values()) {
            const match = this.matchCommandPattern(pattern, query);
            if (match && match.confidence > highestConfidence) {
                bestMatch = match;
                highestConfidence = match.confidence;
            }
        }

        return bestMatch;
    }

    private matchCommandPattern(pattern: CommandPattern, input: string): PatternMatch | null {
        try {
            const regex = this.patternToRegex(pattern.linguisticPattern);
            const match = input.match(regex);

            if (!match) return null;

            const variables: Record<string, string> = {};
            pattern.variables.forEach((variable, index) => {
                variables[variable.name] = match[index + 1];
            });

            const confidence = this.calculateConfidence(pattern, match[0].length / input.length);

            return {
                pattern,
                variables,
                confidence
            };
        } catch (error) {
            return null;
        }
    }

    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const withVariables = escaped.replace(/\{(\w+)\}/g, '(.+)');
        return new RegExp(`^${withVariables}$`, 'i');
    }

    private calculateConfidence(pattern: CommandPattern, matchRatio: number): number {
        const successRate = pattern.usageStats.successfulCalls / Math.max(1, pattern.usageStats.totalCalls);
        const recency = Math.exp(-(Date.now() - pattern.usageStats.lastUsed) / (24 * 60 * 60 * 1000));
        return pattern.confidence * successRate * matchRatio * recency;
    }

    addCommandPattern(pattern: CommandPattern): void {
        if (this.commandPatterns.has(pattern.id)) {
            logger.warn(LogCategory.CACHE, 'Command pattern already exists', {
                metadata: { id: pattern.id }
            });
            return;
        }

        const newPattern: CommandPattern = {
            ...pattern,
            usageStats: {
                totalCalls: 0,
                successfulCalls: 0,
                lastUsed: Date.now(),
                averageLatency: 0
            }
        };

        this.commandPatterns.set(pattern.id, newPattern);
        logger.info(LogCategory.CACHE, 'Command pattern added', {
            metadata: { id: pattern.id }
        });
    }

    updateCommandStats(patternId: string, success: boolean, latencyMs: number): void {
        const pattern = this.commandPatterns.get(patternId);
        if (!pattern) return;

        pattern.usageStats.totalCalls++;
        if (success) {
            pattern.usageStats.successfulCalls++;
        }
        pattern.usageStats.lastUsed = Date.now();
        pattern.usageStats.averageLatency = (
            pattern.usageStats.averageLatency * (pattern.usageStats.totalCalls - 1) + latencyMs
        ) / pattern.usageStats.totalCalls;

        this.commandPatterns.set(patternId, pattern);
    }

    private async validateToolPattern(pattern: ToolPattern): Promise<boolean> {
        if (!pattern.id || !pattern.trigger || !pattern.variables || !pattern.service) {
            return false;
        }

        const variableCount = (pattern.trigger.match(/\*/g) || []).length;
        if (variableCount !== pattern.variables.length) {
            return false;
        }

        if (pattern.confidence < 0 || pattern.confidence > 1) {
            return false;
        }

        return true;
    }

    // Utility methods
    getToolPattern(patternId: string): ToolPattern | undefined {
        return this.toolPatterns.get(patternId);
    }

    getCommandPattern(patternId: string): CommandPattern | undefined {
        return this.commandPatterns.get(patternId);
    }

    listToolPatterns(): ToolPattern[] {
        return Array.from(this.toolPatterns.values());
    }

    listCommandPatterns(): CommandPattern[] {
        return Array.from(this.commandPatterns.values());
    }

    clearAll(): void {
        this.toolPatterns.clear();
        this.commandPatterns.clear();
        logger.info(LogCategory.CACHE, 'All patterns cleared');
    }
} 