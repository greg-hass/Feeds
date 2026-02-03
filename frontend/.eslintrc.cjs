module.exports = {
    root: true,
    extends: ['expo'],
    rules: {
        '@typescript-eslint/ban-types': 'off',
        'no-undef': 'off',
    },
    globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        device: 'readonly',
        element: 'readonly',
        by: 'readonly',
        waitFor: 'readonly',
    },
    ignorePatterns: ['e2e/', '__tests__/'],
};
