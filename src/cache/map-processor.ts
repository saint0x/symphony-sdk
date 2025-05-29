import { parseString } from 'xml2js';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { Logger } from '../utils/logger';
import { IDatabaseService } from '../db/types';

const parseXMLAsync = promisify(parseString);

export interface Variable {
    name: string;
    position: number;
    type: string;
    description: string;
    validation?: {
        allowedValues?: string[];
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
}

export interface Pattern {
    id: string;
    groupType: string;
    confidence: number;
    trigger: string;
    variables: Variable[];
    examples: string[];
    toolName: string;
    parameters: Record<string, string>;
    usageStats: {
        successCount: number;
        failureCount: number;
        lastUsed?: Date;
        averageLatency: number;
    };
}

export interface PatternMatch {
    pattern: Pattern;
    confidence: number;
    extractedVariables: Record<string, any>;
    toolCall: {
        name: string;
        parameters: Record<string, any>;
    };
}

export interface CacheResult {
    matched: boolean;
    confidence: number;
    patternMatch?: PatternMatch;
    shouldUseFastPath: boolean;
    executionTime: number;
}

export class CommandMapProcessor {
    private static instance: CommandMapProcessor;
    private patterns: Map<string, Pattern> = new Map();
    private logger: Logger;
    private database: IDatabaseService;
    private fastPathThreshold: number = 0.85;
    private initialized: boolean = false;

    private constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('CommandMapProcessor');
        this.database = database;
    }

    static getInstance(database: IDatabaseService): CommandMapProcessor {
        if (!CommandMapProcessor.instance) {
            CommandMapProcessor.instance = new CommandMapProcessor(database);
        }
        return CommandMapProcessor.instance;
    }

    async initialize(xmlPath?: string): Promise<void> {
        if (this.initialized) return;

        this.logger.info('CommandMapProcessor', 'Initializing command map processor');

        try {
            // Load patterns from XML file
            if (xmlPath) {
                await this.loadPatternsFromXML(xmlPath);
            }

            // Load patterns from database
            await this.loadPatternsFromDatabase();

            this.initialized = true;
            this.logger.info('CommandMapProcessor', `Loaded ${this.patterns.size} patterns successfully`);
        } catch (error) {
            this.logger.error('CommandMapProcessor', 'Failed to initialize', { error });
            throw error;
        }
    }

    private async loadPatternsFromXML(xmlPath: string): Promise<void> {
        this.logger.info('CommandMapProcessor', `Loading patterns from XML: ${xmlPath}`);

        const xmlContent = readFileSync(xmlPath, 'utf-8');
        const parsed = await parseXMLAsync(xmlContent) as any;

        const commandMap = parsed.CommandMap;
        if (!commandMap || !commandMap.PatternGroup) {
            throw new Error('Invalid command map XML structure');
        }

        for (const group of commandMap.PatternGroup) {
            const groupType = group.$.type;
            
            if (!group.Pattern) continue;

            for (const patternData of group.Pattern) {
                const pattern = this.parseXMLPattern(patternData, groupType);
                this.patterns.set(pattern.id, pattern);

                // Save to database
                await this.savePatternToDatabase(pattern);
            }
        }
    }

    private parseXMLPattern(patternData: any, groupType: string): Pattern {
        const linguistic = patternData.Linguistic[0];
        const toolMapping = patternData.ToolMapping[0];
        const usageStats = patternData.UsageStats[0];

        // Parse variables
        const variables: Variable[] = [];
        if (linguistic.Variables?.[0]?.Variable) {
            for (const varData of linguistic.Variables[0].Variable) {
                variables.push({
                    name: varData.$.name,
                    position: parseInt(varData.$.position),
                    type: varData.Type[0],
                    description: varData.Description[0],
                    validation: varData.Validation?.[0] ? {
                        allowedValues: varData.Validation[0].AllowedValues?.[0]?.Value || undefined
                    } : undefined
                });
            }
        }

        // Parse tool parameters
        const parameters: Record<string, string> = {};
        if (toolMapping.Parameters?.[0]?.Parameter) {
            for (const param of toolMapping.Parameters[0].Parameter) {
                parameters[param.$.name] = param.$.value;
            }
        }

        return {
            id: patternData.$.id,
            groupType,
            confidence: parseFloat(patternData.$.confidence),
            trigger: linguistic.Trigger[0],
            variables,
            examples: linguistic.Examples?.[0]?.Example || [],
            toolName: toolMapping.Tool[0],
            parameters,
            usageStats: {
                successCount: parseInt(usageStats.SuccessCount[0]),
                failureCount: parseInt(usageStats.FailureCount[0]),
                lastUsed: usageStats.LastUsed ? new Date(usageStats.LastUsed[0]) : undefined,
                averageLatency: parseInt(usageStats.AverageLatency[0].replace('ms', ''))
            }
        };
    }

    private async savePatternToDatabase(pattern: Pattern): Promise<void> {
        try {
            const existingPatterns = await this.database.getXMLPatterns();
            const exists = existingPatterns.some((p: any) => p.pattern_id === pattern.id);

            if (!exists) {
                await this.database.saveXMLPattern({
                    pattern_id: pattern.id,
                    group_id: await this.getOrCreateGroupId(pattern.groupType),
                    pattern_name: pattern.id,
                    confidence_score: pattern.confidence,
                    trigger_text: pattern.trigger,
                    variables: JSON.stringify(pattern.variables),
                    examples: JSON.stringify(pattern.examples),
                    tool_name: pattern.toolName,
                    tool_parameters: JSON.stringify(pattern.parameters),
                    success_count: pattern.usageStats.successCount,
                    failure_count: pattern.usageStats.failureCount,
                    average_latency_ms: pattern.usageStats.averageLatency,
                    active: true
                });
            }
        } catch (error) {
            this.logger.error('CommandMapProcessor', `Failed to save pattern ${pattern.id}`, { error });
        }
    }

    private async getOrCreateGroupId(groupType: string): Promise<number> {
        // For now, return a default group ID - in production this would query/create pattern groups
        // Using groupType to avoid unused parameter warning
        this.logger.debug('CommandMapProcessor', `Getting group ID for type: ${groupType}`);
        return 1;
    }

    private async loadPatternsFromDatabase(): Promise<void> {
        this.logger.info('CommandMapProcessor', 'Loading patterns from database');

        const dbPatterns = await this.database.getXMLPatterns(true);
        
        for (const dbPattern of dbPatterns) {
            if (this.patterns.has(dbPattern.pattern_id)) {
                // Update confidence from database
                const pattern = this.patterns.get(dbPattern.pattern_id)!;
                pattern.confidence = dbPattern.confidence_score;
                pattern.usageStats.successCount = dbPattern.success_count;
                pattern.usageStats.failureCount = dbPattern.failure_count;
                pattern.usageStats.averageLatency = dbPattern.average_latency_ms;
            }
        }
    }

    async processUserInput(input: string, sessionId?: string): Promise<CacheResult> {
        const startTime = Date.now();
        
        this.logger.info('CommandMapProcessor', 'Processing user input for pattern match', {
            input: input.substring(0, 100),
            sessionId
        });

        try {
            const match = await this.findBestPattern(input);
            const executionTime = Date.now() - startTime;

            if (match) {
                const shouldUseFastPath = match.confidence >= this.fastPathThreshold;
                
                // Record the pattern match attempt
                if (sessionId) {
                    await this.recordPatternAttempt(match.pattern.id, input, match.extractedVariables, sessionId);
                }

                return {
                    matched: true,
                    confidence: match.confidence,
                    patternMatch: match,
                    shouldUseFastPath,
                    executionTime
                };
            }

            return {
                matched: false,
                confidence: 0,
                shouldUseFastPath: false,
                executionTime
            };
        } catch (error) {
            this.logger.error('CommandMapProcessor', 'Failed to process user input', { error, input });
            return {
                matched: false,
                confidence: 0,
                shouldUseFastPath: false,
                executionTime: Date.now() - startTime
            };
        }
    }

    private async findBestPattern(input: string): Promise<PatternMatch | null> {
        let bestMatch: PatternMatch | null = null;
        let bestScore = 0;

        for (const pattern of this.patterns.values()) {
            const match = this.matchPattern(input, pattern);
            if (match && match.confidence > bestScore) {
                bestMatch = match;
                bestScore = match.confidence;
            }
        }

        return bestMatch;
    }

    private matchPattern(input: string, pattern: Pattern): PatternMatch | null {
        // Convert trigger pattern to regex
        // "search for * in *" becomes /search for (.*?) in (.*)/i
        const triggerRegex = this.buildTriggerRegex(pattern.trigger);
        const match = input.toLowerCase().match(triggerRegex);

        if (!match) return null;

        // Extract variables
        const extractedVariables = this.extractVariables(match, pattern.variables);
        
        // Calculate confidence based on pattern confidence + match quality
        let confidence = pattern.confidence;
        
        // Adjust confidence based on variable extraction quality
        const variableScore = this.calculateVariableScore(extractedVariables, pattern.variables);
        confidence = confidence * variableScore;

        // Build tool call parameters
        const toolCall = this.buildToolCall(pattern, extractedVariables);

        return {
            pattern,
            confidence,
            extractedVariables,
            toolCall
        };
    }

    private buildTriggerRegex(trigger: string): RegExp {
        // Escape special regex characters except *
        const escaped = trigger.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        
        // Replace * with capture groups
        const regexPattern = escaped.replace(/\*/g, '(.*?)');
        
        return new RegExp(`^${regexPattern}$`, 'i');
    }

    private extractVariables(match: RegExpMatchArray, variables: Variable[]): Record<string, any> {
        const extracted: Record<string, any> = {};
        
        // Skip the full match and extract captured groups
        for (let i = 1; i < match.length && i - 1 < variables.length; i++) {
            const variable = variables[i - 1];
            const value = match[i].trim();
            
            extracted[variable.name] = this.castVariable(value, variable.type);
        }

        return extracted;
    }

    private castVariable(value: string, type: string): any {
        switch (type.toLowerCase()) {
            case 'number':
                const num = parseInt(value);
                return isNaN(num) ? value : num;
            case 'boolean':
                return value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
            case 'array':
                return value.split(',').map(s => s.trim());
            default:
                return value;
        }
    }

    private calculateVariableScore(extracted: Record<string, any>, variables: Variable[]): number {
        if (variables.length === 0) return 1.0;

        let score = 0;
        for (const variable of variables) {
            const value = extracted[variable.name];
            if (value !== undefined && value !== '') {
                score += 1;
                
                // Bonus for validation compliance
                if (this.validateVariable(value, variable)) {
                    score += 0.1;
                }
            }
        }

        return Math.min(1.0, score / variables.length);
    }

    private validateVariable(value: any, variable: Variable): boolean {
        if (!variable.validation) return true;

        const validation = variable.validation;
        
        if (validation.allowedValues && !validation.allowedValues.includes(value)) {
            return false;
        }
        
        if (typeof value === 'string') {
            if (validation.minLength && value.length < validation.minLength) return false;
            if (validation.maxLength && value.length > validation.maxLength) return false;
            if (validation.pattern && !new RegExp(validation.pattern).test(value)) return false;
        }

        return true;
    }

    private buildToolCall(pattern: Pattern, variables: Record<string, any>): { name: string; parameters: Record<string, any> } {
        const parameters: Record<string, any> = {};

        for (const [paramName, paramTemplate] of Object.entries(pattern.parameters)) {
            parameters[paramName] = this.interpolateParameter(paramTemplate, variables);
        }

        return {
            name: pattern.toolName,
            parameters
        };
    }

    private interpolateParameter(template: string, variables: Record<string, any>): any {
        // Handle simple variable substitution: ${variableName}
        let result = template.replace(/\${(\w+)}/g, (match, varName) => {
            return variables[varName]?.toString() || match;
        });

        // Handle array conversion: [${target}]
        if (result.startsWith('[') && result.endsWith(']')) {
            const inner = result.slice(1, -1);
            if (variables[inner]) {
                return Array.isArray(variables[inner]) ? variables[inner] : [variables[inner]];
            }
        }

        // Handle boolean expressions: ${background == 'background'}
        const boolMatch = result.match(/\${(\w+)\s*==\s*'([^']+)'}/);
        if (boolMatch) {
            return variables[boolMatch[1]] === boolMatch[2];
        }

        // Try to parse as JSON for complex objects
        if (result.startsWith('{') || result.startsWith('[')) {
            try {
                return JSON.parse(result);
            } catch {
                // Fall back to string
            }
        }

        return result;
    }

    private async recordPatternAttempt(
        patternId: string, 
        input: string, 
        variables: Record<string, any>, 
        sessionId: string
    ): Promise<void> {
        try {
            // Get pattern database ID
            const patterns = await this.database.getXMLPatterns();
            const pattern = patterns.find((p: any) => p.pattern_id === patternId);
            
            if (pattern) {
                await this.database.recordPatternExecution({
                    pattern_id: pattern.id || 0,
                    execution_id: `pattern_attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    input_text: input,
                    extracted_variables: JSON.stringify(variables),
                    tool_result: JSON.stringify({ status: 'attempted' }),
                    success: true, // We'll update this later based on tool execution results
                    execution_time_ms: 0, // Will be updated after tool execution
                    session_id: sessionId
                });
            }
        } catch (error) {
            this.logger.error('CommandMapProcessor', 'Failed to record pattern attempt', { error, patternId });
        }
    }

    async updatePatternConfidence(patternId: string, success: boolean, executionTime: number): Promise<void> {
        try {
            const pattern = this.patterns.get(patternId);
            if (!pattern) return;

            // Update local pattern stats
            if (success) {
                pattern.usageStats.successCount++;
            } else {
                pattern.usageStats.failureCount++;
            }
            
            pattern.usageStats.lastUsed = new Date();
            
            // Update average latency (moving average)
            const totalExecutions = pattern.usageStats.successCount + pattern.usageStats.failureCount;
            pattern.usageStats.averageLatency = 
                ((pattern.usageStats.averageLatency * (totalExecutions - 1)) + executionTime) / totalExecutions;

            // Recalculate confidence based on success rate
            const successRate = pattern.usageStats.successCount / totalExecutions;
            const newConfidence = Math.min(0.99, Math.max(0.1, successRate * pattern.confidence));
            pattern.confidence = newConfidence;

            // Update database
            await this.database.updatePatternConfidence(patternId, newConfidence);

            this.logger.info('CommandMapProcessor', `Updated pattern confidence`, {
                patternId,
                newConfidence: newConfidence.toFixed(3),
                successRate: (successRate * 100).toFixed(1) + '%',
                totalExecutions
            });
        } catch (error) {
            this.logger.error('CommandMapProcessor', 'Failed to update pattern confidence', { error, patternId });
        }
    }

    getPatterns(): Pattern[] {
        return Array.from(this.patterns.values());
    }

    getPattern(id: string): Pattern | undefined {
        return this.patterns.get(id);
    }

    getPatternsByTool(toolName: string): Pattern[] {
        return Array.from(this.patterns.values()).filter(p => p.toolName === toolName);
    }

    setFastPathThreshold(threshold: number): void {
        this.fastPathThreshold = Math.max(0.1, Math.min(0.99, threshold));
        this.logger.info('CommandMapProcessor', `Updated fast path threshold to ${this.fastPathThreshold}`);
    }
} 