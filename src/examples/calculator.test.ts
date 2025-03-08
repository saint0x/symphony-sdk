import { describe, expect, it } from "bun:test";
import { symphonyInference } from '../symphony/inference/integration';
import { calculatorTool, CalculatorAgent } from './calculator';
import { reverserTool, ReverserAgent } from './string-reverser';
import { ToolConfig } from '../types/sdk';

describe('Tool Type Inference', () => {
    describe('Calculator Tool', () => {
        it('should correctly perform basic calculations', async () => {
            const agent = new CalculatorAgent();
            
            const result1 = await agent.add(5, 3);
            expect(result1).toBe(8);
            
            const result2 = await agent.add(3.14, 2.86);
            expect(result2).toBe(6);
            
            const result3 = await agent.add(-10, 7);
            expect(result3).toBe(-3);
        });

        it('should correctly infer types from partial config', async () => {
            const partialConfig: Partial<ToolConfig> = {
                name: 'calculator',
                description: 'A simple calculator',
                type: 'tool' as const
            };

            const enhancedTool = await symphonyInference.enhanceTool(partialConfig);
            
            // Verify tool metadata
            expect(enhancedTool.name).toBe('calculator');
            expect(enhancedTool.description).toBeDefined();
            
            // Verify inferred types match original tool
            expect(enhancedTool.inputs).toEqual(calculatorTool.inputs);
            expect(enhancedTool.outputs).toEqual(calculatorTool.outputs);
            
            // Test the inferred tool functionality
            if (enhancedTool.handler) {
                const result = await enhancedTool.handler({ a: 10, b: 5 });
                expect(result.success).toBe(true);
                expect(result.result?.sum).toBe(15);
            }
        });

        it('should handle invalid inputs gracefully', async () => {
            const agent = new CalculatorAgent();
            
            // @ts-expect-error Testing invalid input
            await expect(agent.add('not a number', 3)).rejects.toThrow();
            
            // @ts-expect-error Testing invalid input
            await expect(agent.add(5, 'not a number')).rejects.toThrow();
        });
    });

    describe('Reverser Tool', () => {
        it('should correctly reverse strings', async () => {
            const agent = new ReverserAgent();
            
            const result1 = await agent.reverse('hello');
            expect(result1).toBe('olleh');
            
            const result2 = await agent.reverse('12345');
            expect(result2).toBe('54321');
            
            const result3 = await agent.reverse('');
            expect(result3).toBe('');
        });

        it('should correctly infer types from partial config', async () => {
            const partialConfig: Partial<ToolConfig> = {
                name: 'reverser',
                description: 'A string reverser',
                type: 'tool' as const
            };

            const enhancedTool = await symphonyInference.enhanceTool(partialConfig);
            
            // Verify tool metadata
            expect(enhancedTool.name).toBe('reverser');
            expect(enhancedTool.description).toBeDefined();
            
            // Verify inferred types match original tool
            expect(enhancedTool.inputs).toEqual(reverserTool.inputs);
            expect(enhancedTool.outputs).toEqual(reverserTool.outputs);
            
            // Test the inferred tool functionality
            if (enhancedTool.handler) {
                const result = await enhancedTool.handler({ text: 'hello' });
                expect(result.success).toBe(true);
                expect(result.result?.reversed).toBe('olleh');
            }
        });

        it('should handle invalid inputs gracefully', async () => {
            const agent = new ReverserAgent();
            
            // @ts-expect-error Testing invalid input
            await expect(agent.reverse(123)).rejects.toThrow();
            
            // @ts-expect-error Testing invalid input
            await expect(agent.reverse(null)).rejects.toThrow();
        });
    });
}); 