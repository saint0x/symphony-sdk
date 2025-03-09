import * as path from 'path';

export const PATHS = {
    SYSTEM_PROMPT: path.join(__dirname, '..', 'agents', 'sysprompt.xml'),
    CONFIGS: path.join(__dirname, '..', 'config'),
    TOOLS: path.join(__dirname, '..', 'tools'),
    AGENTS: path.join(__dirname, '..', 'agents'),
} as const;

export default PATHS; 