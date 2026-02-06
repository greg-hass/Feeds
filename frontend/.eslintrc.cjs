module.exports = {
    root: true,
    extends: ['expo'],
    rules: {
        '@typescript-eslint/ban-types': 'off',
        'no-undef': 'off',
        // Downgrade strict hooks rules to warnings - these are valid patterns
        // (mounting effects, animation refs, Date calculations for display)
        'react-hooks/set-state-in-effect': 'warn',
        'react-hooks/purity': 'warn',
        'react-hooks/preserve-manual-memoization': 'warn',
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
