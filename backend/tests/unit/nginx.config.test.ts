import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('docker nginx config', () => {
    it('preserves the /api prefix when proxying backend requests', () => {
        const configPath = resolve(process.cwd(), '../docker/nginx.conf');
        const config = readFileSync(configPath, 'utf8');

        expect(config).toContain('location /api/');
        expect(config).toContain('proxy_pass http://127.0.0.1:3001;');
        expect(config).not.toContain('proxy_pass http://127.0.0.1:3001/;');
    });
});
