import {
    INlpService,
    NlpPatternDefinition,
    NlpManagementResult,
    StoredNlpPattern,
    NlpSeedOptions,
    ErrorDetail
} from '../types/tool.types';
import { IDatabaseService } from '../db/IDatabaseService';
import { IContextAPI } from '../api/IContextAPI';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { ValidationError } from '../errors/index';

/**
 * NlpService provides functionalities to manage NLP patterns associated with tools,
 * including seeding them into a persistent store and loading them for runtime use.
 */
export class NlpService implements INlpService {
    private logger = new Logger('NlpService');

    constructor(
        private databaseService: IDatabaseService,
        private contextIntelligenceApi: IContextAPI
    ) {}

    async seedPatterns(patterns: NlpPatternDefinition[], options?: NlpSeedOptions): Promise<NlpManagementResult> {
        this.logger.info('seedPatterns', `Starting to seed ${patterns.length} NLP patterns.`);
        const results: NlpManagementResult = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            totalAttempted: patterns.length,
        };

        for (const pDef of patterns) {
            try {
                const patternToEnsure: NlpPatternDefinition = {
                    ...pDef,
                    source: pDef.source || options?.defaultSource || 'seed_operation',
                    isActive: pDef.isActive === undefined ? true : pDef.isActive,
                };

                // Use ensurePatternPersisted logic for each pattern in seed
                const outcome = await this.ensurePatternPersistedInternal(patternToEnsure, options?.forceOverwrite, true);
                
                if (outcome.status === 'created') results.created++;
                else if (outcome.status === 'updated') results.updated++;
                else if (outcome.status === 'skipped') results.skipped++;

            } catch (error: any) {
                this.logger.error('seedPatterns', `Failed to seed pattern for tool '${pDef.toolName}': ${error.message}`, { error });
                results.failed++;
                results.errors.push({
                    item: pDef,
                    message: `Failed to seed pattern: ${error.message}`,
                    error,
                });
            }
        }
        this.logger.info('seedPatterns', `Seeding complete: ${JSON.stringify(results, null, 2)}`);
        return results;
    }

    async seedPatternsFromFile(filePath: string, options?: NlpSeedOptions): Promise<NlpManagementResult> {
        this.logger.info('seedPatternsFromFile', `Attempting to seed NLP patterns from file: ${filePath}`);
        let patternsData: NlpPatternDefinition[] = [];
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            if (path.extname(filePath).toLowerCase() === '.json') {
                patternsData = JSON.parse(fileContent);
            } else if (path.extname(filePath).toLowerCase().match(/\.ya?ml$/)) {
                // Placeholder for YAML parsing logic if js-yaml is added
                this.logger.warn('seedPatternsFromFile', 'YAML parsing is not yet implemented. Skipping YAML file.');
                throw new ValidationError(
                    'YAML parsing not implemented',
                    { filePath, extension: path.extname(filePath) },
                    { component: 'NlpService', operation: 'seedPatternsFromFile' }
                );
            } else {
                throw new ValidationError(
                    `Unsupported file format: ${path.extname(filePath)}. Only .json and .yaml/.yml are supported.`,
                    { filePath, extension: path.extname(filePath), supportedFormats: ['.json', '.yaml', '.yml'] },
                    { component: 'NlpService', operation: 'seedPatternsFromFile' }
                );
            }

            if (!Array.isArray(patternsData)) {
                throw new ValidationError(
                    'File content must be an array of NlpPatternDefinition objects',
                    { filePath, contentType: typeof patternsData },
                    { component: 'NlpService', operation: 'seedPatternsFromFile' }
                );
            }
            return this.seedPatterns(patternsData, options);
        } catch (error: any) {
            this.logger.error('seedPatternsFromFile', `Failed to seed patterns from file ${filePath}: ${error.message}`, { error });
            const errorDetail: ErrorDetail = { message: `Failed to load or parse file ${filePath}: ${error.message}`, error };
            return {
                created: 0, updated: 0, skipped: 0,
                failed: patternsData.length || 1, // assume one failure if parsing failed early
                errors: [errorDetail],
                totalAttempted: patternsData.length || 1,
            };
        }
    }
    
    private async ensurePatternPersistedInternal(patternDef: NlpPatternDefinition, forceOverwrite: boolean = false, isSeeding: boolean = false):
        Promise<{status: 'created' | 'updated' | 'skipped' | 'failed', pattern?: StoredNlpPattern, error?: any}> {
        this.logger.info('ensurePatternPersistedInternal', `[DEBUG] Entry for ${patternDef.toolName}, forceOverwrite: ${forceOverwrite}`);
        try {
            this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] Searching existing by toolName/nlpPattern for ${patternDef.toolName}`);
            let existingPattern = await this.databaseService.findNlpPatternRecord({
                toolName: patternDef.toolName,
                nlpPattern: patternDef.nlpPattern,
            });
            this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] findNlpPatternRecord by toolName/nlpPattern result: ${existingPattern ? existingPattern.id : null} for ${patternDef.toolName}`);

            if (!existingPattern && patternDef.id) {
                this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] Searching existing by ID ${patternDef.id} for ${patternDef.toolName}`);
                existingPattern = await this.databaseService.getNlpPatternRecordById(patternDef.id);
                this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] getNlpPatternRecordById result: ${existingPattern ? existingPattern.id : null} for ${patternDef.toolName}`);
            }

            const now = new Date();
            if (existingPattern) {
                this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] Existing pattern found: ${existingPattern.id} for ${patternDef.toolName}`);
                if (forceOverwrite || (patternDef.id && patternDef.id === existingPattern.id)) {
                    this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] Updating existing NLP pattern ID: ${existingPattern.id}`);
                    const updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt'>> = {
                        nlpPattern: patternDef.nlpPattern, // Allow NLP string update
                        version: patternDef.version || existingPattern.version,
                        isActive: patternDef.isActive === undefined ? existingPattern.isActive : patternDef.isActive,
                        source: patternDef.source || existingPattern.source,
                        toolName: patternDef.toolName, // Allow toolName update if necessary, though rare for existing ID
                        updatedAt: now,
                    };
                    const updated = await this.databaseService.updateNlpPatternRecord(existingPattern.id, updates);
                    this.logger.info('ensurePatternPersistedInternal', `[DEBUG] Update result: ${updated ? 'success' : 'null'} for ${patternDef.toolName}`);
                    if (!updated) throw new ValidationError(
                        'DB updateNlpPatternRecord returned null',
                        { patternId: existingPattern.id, updates },
                        { component: 'NlpService', operation: 'updateNlpPattern' }
                    );
                    return { status: 'updated', pattern: updated };
                } else {
                    this.logger.info('ensurePatternPersistedInternal', `[DEBUG] Skipped existing pattern ID: ${existingPattern.id} for ${patternDef.toolName}, forceOverwrite=${forceOverwrite}, patternDef.id=${patternDef.id}`);
                    this.logger.debug('ensurePatternPersistedInternal', `NLP pattern for tool '${patternDef.toolName}' with content '${patternDef.nlpPattern.substring(0,30)}...' already exists and forceOverwrite is false. Skipped.`);
                    return { status: 'skipped', pattern: existingPattern };
                }
            } else {
                this.logger.info('ensurePatternPersistedInternal', `[DEBUG] Creating new NLP pattern for tool '${patternDef.toolName}'.`);
                const newStoredPattern: StoredNlpPattern = {
                    id: patternDef.id || uuidv4(),
                    toolName: patternDef.toolName,
                    nlpPattern: patternDef.nlpPattern,
                    version: patternDef.version,
                    isActive: patternDef.isActive === undefined ? true : patternDef.isActive,
                    source: patternDef.source || (isSeeding ? 'seed_operation' : 'runtime_creation'),
                    createdAt: now,
                    updatedAt: now,
                };
                this.logger.debug('ensurePatternPersistedInternal', `[DEBUG] Calling saveNlpPatternRecord for ${newStoredPattern.id}`);
                const saved = await this.databaseService.saveNlpPatternRecord(newStoredPattern);
                this.logger.info('ensurePatternPersistedInternal', `[DEBUG] Save result: ${saved ? 'success' : 'null'} for ${patternDef.toolName}, ID: ${saved?.id}`);
                return { status: 'created', pattern: saved };
            }
        } catch (error) {
            this.logger.error('ensurePatternPersistedInternal', 'ensurePatternPersistedInternal failed', { error });
            return { status: 'failed', error };
        }
    }

    async ensurePatternPersisted(patternDef: NlpPatternDefinition, options?: { forceOverwrite?: boolean }): Promise<StoredNlpPattern> {
        this.logger.info('ensurePatternPersisted', `[DEBUG] Entry for ${patternDef.toolName}`);
        const outcome = await this.ensurePatternPersistedInternal(patternDef, options?.forceOverwrite, false);
        this.logger.info('ensurePatternPersisted', `[DEBUG] Internal call returned: ${outcome.status} for ${patternDef.toolName}`);
        if (outcome.status === 'failed' || !outcome.pattern) {
            this.logger.error('ensurePatternPersisted', `ensurePatternPersisted failed for tool '${patternDef.toolName}'`, { error: outcome.error });
            throw outcome.error || new ValidationError(
                'Failed to ensure pattern persistence',
                { toolName: patternDef.toolName },
                { component: 'NlpService', operation: 'ensurePatternPersisted' }
            );
        }
        this.logger.info('ensurePatternPersisted', `[DEBUG] Exiting successfully for ${patternDef.toolName}`);
        return outcome.pattern;
    }

    async getNlpPatternById(patternId: string): Promise<StoredNlpPattern | null> {
        this.logger.debug('getNlpPatternById', `Retrieving NLP pattern by ID: ${patternId}`);
        return this.databaseService.getNlpPatternRecordById(patternId);
    }

    async getNlpPatternsByTool(toolName: string): Promise<StoredNlpPattern[]> {
        this.logger.debug('getNlpPatternsByTool', `Retrieving NLP patterns for tool: ${toolName}`);
        return this.databaseService.getNlpPatternRecordsByTool(toolName);
    }

    async addNlpPattern(patternDef: NlpPatternDefinition, options?: { allowUpdate?: boolean }): Promise<StoredNlpPattern> {
        this.logger.debug('addNlpPattern', `Adding NLP pattern for tool: ${patternDef.toolName}`);
        // ensurePatternPersisted will handle creation or update based on allowUpdate (via forceOverwrite)
        const outcome = await this.ensurePatternPersistedInternal(patternDef, options?.allowUpdate, false);
        if (outcome.status === 'failed' || !outcome.pattern) {
            this.logger.error('addNlpPattern', `addNlpPattern failed for tool '${patternDef.toolName}'`, { error: outcome.error });
            throw outcome.error || new ValidationError(
                'Failed to add pattern',
                { toolName: patternDef.toolName },
                { component: 'NlpService', operation: 'addNlpPattern' }
            );
        }
        if (outcome.status === 'skipped' && !options?.allowUpdate) {
             this.logger.warn('addNlpPattern', `Pattern for tool ${patternDef.toolName} already exists and allowUpdate was false.`);
             // Depending on desired strictness, could throw error here if 'skipped' is not an acceptable outcome for 'add'
        }
        return outcome.pattern;
    }

    async updateNlpPattern(patternId: string, updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern> {
        this.logger.info('NlpService', `Updating NLP pattern: ${patternId}`);
        const updated = await this.databaseService.updateNlpPatternRecord(patternId, updates);
        if (!updated) {
            throw new ValidationError(
                'DB updateNlpPatternRecord returned null',
                { patternId, updates },
                { component: 'NlpService', operation: 'updateNlpPattern' }
            );
        }
        return updated;
    }

    async deleteNlpPattern(patternId: string): Promise<boolean> {
        this.logger.info('NlpService', `Attempting to delete NLP pattern: ${patternId}`);
        
        const deleted = await this.databaseService.deleteNlpPatternRecord(patternId);
        if (!deleted) {
            throw new ValidationError(
                `Failed to update NLP pattern or pattern not found: ${patternId}`,
                { patternId },
                { component: 'NlpService', operation: 'deleteNlpPattern' }
            );
        }
        
        return deleted;
    }

    async loadPatternToRuntime(pattern: NlpPatternDefinition): Promise<void> {
        this.logger.info('loadPatternToRuntime', `Loading NLP pattern to runtime for tool: ${pattern.toolName}`);
        try {
            await this.contextIntelligenceApi.registerToolNlpMapping({
                toolName: pattern.toolName,
                nlpPattern: pattern.nlpPattern,
                source: pattern.source || 'runtime_load'
            });
            this.logger.debug('loadPatternToRuntime', `Pattern for '${pattern.toolName}' loaded into runtime command map.`);
        } catch (error) {
            this.logger.error('NlpService', `Failed to load pattern to runtime via ContextIntelligenceAPI for tool '${pattern.toolName}'`, { error });
            // Decide if this error should be re-thrown or handled
        }
    }

    async loadAllPersistedPatternsToRuntime(): Promise<{ loaded: number; failed: number; errors: ErrorDetail[] }> {
        this.logger.info('loadAllPersistedPatternsToRuntime', 'Attempting to load all persisted NLP patterns to runtime memory.');
        let loaded = 0;
        let failed = 0;
        const errors: ErrorDetail[] = [];

        try {
            // This assumes a method getAllNlpPatternRecords exists on IDatabaseService
            // We will add this method to IDatabaseService and implement it in DatabaseService next.
            // For now, to make NlpService complete, we refer to it.
            const persistedPatterns: StoredNlpPattern[] = await this.databaseService.getAllNlpPatternRecords ? 
                                                        await this.databaseService.getAllNlpPatternRecords() :
                                                        await this.databaseService.countNlpPatternRecords({isActive: true}) > 0 ? [] : []; // fallback to avoid error if method missing
            
            if (!this.databaseService.getAllNlpPatternRecords) {
                 this.logger.warn('loadAllPersistedPatternsToRuntime', 'databaseService.getAllNlpPatternRecords() method is not defined. Cannot load all persisted patterns.');
                 // To prevent breaking, return an empty/failure state if the method isn't there yet.
                 // This should be resolved by adding the method to IDatabaseService.
                 errors.push({message: 'getAllNlpPatternRecords is not implemented in DatabaseService' });
                 return { loaded, failed: persistedPatterns.length || 1, errors };
            }

            this.logger.info('loadAllPersistedPatternsToRuntime', `Found ${persistedPatterns.length} persisted patterns to potentially load.`);

            for (const pattern of persistedPatterns) {
                if (pattern.isActive === false) {
                    this.logger.debug('loadAllPersistedPatternsToRuntime', `Skipping inactive pattern ID: ${pattern.id}`);
                    continue;
                }
                try {
                    // loadPatternToRuntime expects NlpPatternDefinition, StoredNlpPattern is compatible
                    await this.loadPatternToRuntime(pattern); 
                    loaded++;
                } catch (err: any) {
                    failed++;
                    errors.push({ identifier: pattern.id, item: pattern, message: err.message, error: err });
                    this.logger.warn('loadAllPersistedPatternsToRuntime', `Failed to load persisted pattern ID '${pattern.id}' to runtime.`, {error: err});
                }
            }
            this.logger.info('loadAllPersistedPatternsToRuntime', `Finished loading persisted patterns to runtime. Loaded: ${loaded}, Failed: ${failed}.`);
            return { loaded, failed, errors };
        } catch (error: any) {
            this.logger.error('loadAllPersistedPatternsToRuntime', 'Critical error during loadAllPersistedPatternsToRuntime', { error });
            errors.push({ message: 'Overall failure in loadAllPersistedPatternsToRuntime: ' + error.message, error });
            return { loaded, failed: failed > 0 ? failed : 1 , errors };
        }
    }
} 