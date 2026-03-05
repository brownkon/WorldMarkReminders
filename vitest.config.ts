import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            reporter: ['text', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'],
        },
    },
    resolve: {
        alias: {
            '@config': path.resolve(__dirname, './src/config'),
            '@db': path.resolve(__dirname, './src/db'),
            '@services': path.resolve(__dirname, './src/services'),
            '@api': path.resolve(__dirname, './src/api'),
            '@utils': path.resolve(__dirname, './src/utils'),
        },
    },
});
