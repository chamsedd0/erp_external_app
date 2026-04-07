/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    // Increase timeout for route tests that may involve multiple async calls
    testTimeout: 10000,
};
