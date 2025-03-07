import { AuthConfig } from '../types';
import { logger, LogCategory } from '../../../../utils/logger';

export class AuthHandler {
    private config: AuthConfig;
    private token: string | null = null;
    private tokenExpiry: number | null = null;
    private refreshPromise: Promise<void> | null = null;

    constructor(config: AuthConfig) {
        this.config = config;
        if (config.credentials?.token) {
            this.token = config.credentials.token;
        }
    }

    private async handleBasicAuth(): Promise<Record<string, string>> {
        if (!this.config.credentials?.username || !this.config.credentials?.password) {
            throw new Error('Username and password required for basic auth');
        }

        const credentials = Buffer.from(
            `${this.config.credentials.username}:${this.config.credentials.password}`
        ).toString('base64');

        return {
            'Authorization': `Basic ${credentials}`
        };
    }

    private async handleBearerAuth(): Promise<Record<string, string>> {
        if (!this.token) {
            await this.refreshAuth();
        }

        if (!this.token) {
            throw new Error('Failed to obtain bearer token');
        }

        return {
            'Authorization': `Bearer ${this.token}`
        };
    }

    private async handleOAuth2(): Promise<Record<string, string>> {
        if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
            await this.refreshAuth();
        }

        if (!this.token) {
            throw new Error('Failed to obtain OAuth2 token');
        }

        return {
            'Authorization': `Bearer ${this.token}`
        };
    }

    public async getAuthHeaders(): Promise<Record<string, string>> {
        try {
            switch (this.config.type) {
                case 'basic':
                    return await this.handleBasicAuth();
                case 'bearer':
                    return await this.handleBearerAuth();
                case 'oauth2':
                    return await this.handleOAuth2();
                default:
                    throw new Error(`Unsupported auth type: ${this.config.type}`);
            }
        } catch (error) {
            logger.error(LogCategory.SYSTEM, 'Failed to get auth headers', {
                metadata: {
                    type: this.config.type,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
            throw error;
        }
    }

    public async refreshAuth(): Promise<void> {
        // If a refresh is already in progress, wait for it
        if (this.refreshPromise) {
            await this.refreshPromise;
            return;
        }

        try {
            this.refreshPromise = (async () => {
                if (!this.config.refreshToken) {
                    throw new Error('No refresh token function provided');
                }

                logger.debug(LogCategory.SYSTEM, 'Refreshing authentication token', {
                    metadata: {
                        type: this.config.type
                    }
                });

                const newToken = await this.config.refreshToken();
                this.token = newToken;
                // Set token expiry to slightly less than actual to account for clock skew
                this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

                logger.info(LogCategory.SYSTEM, 'Authentication token refreshed', {
                    metadata: {
                        type: this.config.type,
                        expiresIn: '55 minutes'
                    }
                });
            })();

            await this.refreshPromise;
        } catch (error) {
            logger.error(LogCategory.SYSTEM, 'Failed to refresh authentication', {
                metadata: {
                    type: this.config.type,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
            throw error;
        } finally {
            this.refreshPromise = null;
        }
    }
} 