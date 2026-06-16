import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  async onSuccess() {
    // Copy templates and strategies to dist after build
    const { copyFileSync, mkdirSync, readdirSync, existsSync } = await import('fs');
    const path = await import('path');

    function copyDir(src: string, dest: string) {
      mkdirSync(dest, { recursive: true });
      const entries = readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          copyFileSync(srcPath, destPath);
        }
      }
    }

    // Copy prompts/templates
    const srcTemplates = path.join(process.cwd(), 'src/prompts/templates');
    const distTemplates = path.join(process.cwd(), 'dist/templates');
    if (existsSync(srcTemplates)) {
      copyDir(srcTemplates, distTemplates);
      console.log('✓ Copied templates to dist');
    }

    // Copy strategies
    const srcStrategies = path.join(process.cwd(), 'src/strategies');
    const distStrategies = path.join(process.cwd(), 'dist/strategies');
    if (existsSync(srcStrategies)) {
      copyDir(srcStrategies, distStrategies);
      console.log('✓ Copied strategies to dist');
    }

    // Copy compliance data
    const srcCompliance = path.join(process.cwd(), 'data/compliance');
    const distCompliance = path.join(process.cwd(), 'dist/data/compliance');
    if (existsSync(srcCompliance)) {
      copyDir(srcCompliance, distCompliance);
      console.log('✓ Copied compliance data to dist');
    }
  },
});
