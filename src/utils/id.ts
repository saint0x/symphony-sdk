/**
 * Generates a unique identifier using a timestamp and random string
 * @returns A unique string identifier
 */
export function generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${random}`;
} 