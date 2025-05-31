import { JSONFuzzyFixer } from './src/utils/json-fuzzy-fix';

console.log('=== Testing JSON Fuzzy Fixer ===\n');

// Test cases with common LLM mistakes
const testCases = [
    {
        name: 'Unquoted keys',
        input: '{path: "test.txt", content: "hello"}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Single quotes',
        input: "{'path': 'test.txt', 'content': 'hello world'}",
        expected: { path: 'test.txt', content: 'hello world' }
    },
    {
        name: 'Trailing comma',
        input: '{"path": "test.txt", "content": "hello",}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Missing comma',
        input: '{"path": "test.txt" "content": "hello"}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Mixed issues',
        input: "{path: 'test.txt', content: 'hello world',}",
        expected: { path: 'test.txt', content: 'hello world' }
    },
    {
        name: 'Multiline JSON',
        input: `{
  path: "config.json",
  content: "test content",
  nested: {
    key: 'value'
  }
}`,
        expected: { path: 'config.json', content: 'test content', nested: { key: 'value' } }
    },
    {
        name: 'Already valid JSON',
        input: '{"path": "test.txt", "content": "hello"}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Comments in JSON',
        input: `{
  "path": "test.txt", // file path
  "content": "hello" /* file content */
}`,
        expected: { path: 'test.txt', content: 'hello' }
    },
    // New test cases for enhanced functionality
    {
        name: 'Missing outer braces',
        input: 'path: "test.txt", content: "hello"',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Multiple commas',
        input: '{"path": "test.txt",, "content": "hello"}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Boolean as string',
        input: '{"active": "true", "disabled": "false", "data": "null"}',
        expected: { active: true, disabled: false, data: null }
    },
    {
        name: 'Unquoted values with missing comma',
        input: '{key: value another: test}',
        expected: { key: 'value', another: 'test' }
    },
    {
        name: 'Complex missing comma case',
        input: '{key: "value" another: "test"}',
        expected: { key: 'value', another: 'test' }
    },
    {
        name: 'Unbalanced quotes',
        input: '{"path": "test.txt", "content": "hello}',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Missing closing brace',
        input: '{"path": "test.txt", "content": "hello"',
        expected: { path: 'test.txt', content: 'hello' }
    },
    {
        name: 'Unescaped quotes in string',
        input: '{"message": "He said "hello" to me"}',
        expected: { message: 'He said "hello" to me' }
    }
];

// Run tests
let passCount = 0;
let failCount = 0;

testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log('Input:', test.input.replace(/\n/g, '\\n'));
    
    const result = JSONFuzzyFixer.parse(test.input);
    
    if (result) {
        const passed = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log('Result:', result);
        console.log('Status:', passed ? '✅ PASS' : '❌ FAIL');
        if (!passed) {
            console.log('Expected:', test.expected);
        }
        passed ? passCount++ : failCount++;
    } else {
        console.log('Status: ❌ FAIL - Could not parse');
        failCount++;
    }
    console.log('');
});

console.log(`\nSummary: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests\n`);

// Test the fix method directly
console.log('\n=== Testing fix() method directly ===\n');

const fixTests = [
    '{key: "value"}',
    "{'key': 'value'}",
    '{"key": "value",}',
    '{key: "value" another: "test"}',
    'path: "test.txt", content: "hello"',
    '{"active": "true", "count": 5}',
    '{"msg": "Say "hi" please"}'
];

fixTests.forEach(test => {
    console.log('Original:', test);
    const fixed = JSONFuzzyFixer.fix(test);
    console.log('Fixed:   ', fixed);
    try {
        const parsed = JSON.parse(fixed);
        console.log('Valid JSON: ✅', parsed);
    } catch {
        console.log('Valid JSON: ❌');
    }
    console.log('');
});

console.log('=== Test Complete ==='); 