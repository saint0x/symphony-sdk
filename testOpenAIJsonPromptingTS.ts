import https from 'https';
import { Logger } from './src/utils/logger'; // Assuming logger is available and set up
import { LogLevel } from './src/types/sdk';

// Ensure OPENAI_API_KEY is set in your environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const logger = Logger.getInstance('OpenAIJsonPromptingTestTS');
logger.setMinLevel(LogLevel.INFO);

const SYSTEM_PROMPT_BASE = "You are a helpful assistant.";
const JSON_REQUIREMENT_PROMPT = `
--- BEGIN SDK JSON REQUIREMENTS ---
YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. DO NOT ADD ANY TEXT BEFORE OR AFTER THIS JSON OBJECT.
// For this test, let's assume no tools are configured, so we expect the 'no tool' structure.
YOUR JSON object MUST contain a "tool_name" (string) key set EXPLICITLY to "none", AND a "response" (string) key with your direct textual answer.
FAILURE TO ADHERE TO THIS JSON STRUCTURE WILL RESULT IN AN ERROR.
--- END SDK JSON REQUIREMENTS ---`;

const FULL_SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}${JSON_REQUIREMENT_PROMPT}`;
const USER_TASK = "Extract the name and job title from the following text: 'Sarah Davis is the lead software engineer at TechSolutions Inc.' Present this as structured data.";

interface OpenAIRequestPayload {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    response_format?: { type: string };
}

async function makeOpenAIRequest(payload: OpenAIRequestPayload, callDesc: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': data.length,
            },
        };

        logger.info(callDesc, 'Request Payload:', payload);

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(responseBody);
                    logger.info(callDesc, 'Status Code:', res.statusCode);
                    logger.info(callDesc, 'Response Body:', parsedBody);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedBody);
                    } else {
                        reject(new Error(`API request failed with status ${res.statusCode}: ${responseBody}`));
                    }
                } catch (e) {
                    logger.error(callDesc, 'Error parsing JSON response:', responseBody);
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            logger.error(callDesc, 'Request Error:', error);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function runTest() {
    if (!OPENAI_API_KEY) {
        logger.error('TestInit', 'OPENAI_API_KEY environment variable is not set. Skipping test.');
        console.error("ERROR: OPENAI_API_KEY is not set. Please set it before running the test.");
        return;
    }

    logger.info('TestInit', '=================================================================');
    logger.info('TestInit', 'CALL 1: Strong Prompting Only (NO response_format parameter)');
    logger.info('TestInit', '=================================================================');

    const payload1: OpenAIRequestPayload = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: FULL_SYSTEM_PROMPT },
            { role: "user", content: USER_TASK },
        ],
        temperature: 0.1,
    };

    try {
        const response1 = await makeOpenAIRequest(payload1, 'CALL_1_PROMPT_ONLY');
        // Further checks on response1.choices[0].message.content can be added here
    } catch (error) {
        logger.error('CALL_1_PROMPT_ONLY', 'Failed:', error);
    }

    logger.info('TestInit', '\n\n======================================================================================');
    logger.info('TestInit', 'CALL 2: Strong Prompting AND response_format: { type: "json_object" }');
    logger.info('TestInit', '======================================================================================');

    const payload2: OpenAIRequestPayload = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: FULL_SYSTEM_PROMPT },
            { role: "user", content: USER_TASK },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
    };

    try {
        const response2 = await makeOpenAIRequest(payload2, 'CALL_2_PROMPT_AND_FORMAT');
        // Further checks on response2.choices[0].message.content can be added here
    } catch (error) {
        logger.error('CALL_2_PROMPT_AND_FORMAT', 'Failed:', error);
    }
}

runTest(); 