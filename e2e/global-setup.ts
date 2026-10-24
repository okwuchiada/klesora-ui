import { execFileSync } from 'node:child_process';

// Build the docs site once before all workers start (it also fails on broken links).
export default function globalSetup() {
  execFileSync(process.execPath, ['scripts/build-docs.mjs'], { stdio: 'inherit' });
}
