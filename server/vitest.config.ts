import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // Licensing is infrastructure, not the feature under test — bypass the gate in unit/integration tests.
    env: { POS_LICENSE_BYPASS: '1' },
  },
});
