import { defineConfig } from 'tsup';
export default defineConfig({ noExternal: ['@sports/db', '@sports/shared'] });
