import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // SQLite uses a single file on disk (./data/exchange.db), so tests must run sequentially
    // to avoid cross-worker database collisions and race conditions.
    fileParallelism: false,
  },
});
