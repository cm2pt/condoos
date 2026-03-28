import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/]react/, priority: 20 },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]react-query/, priority: 15 },
            { name: 'vendor-motion', test: /node_modules[\\/]framer-motion/, priority: 15 },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react/, priority: 15 },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "src/test/setup.js",
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/financeUtils.js", "src/lib/icons.js"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
