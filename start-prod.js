import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the built server file
const serverPath = join(__dirname, 'dist', 'index.js');
let serverCode = readFileSync(serverPath, 'utf-8');

// Replace import.meta.dirname with a compatible version
const dirnameReplacement = `"${__dirname}"`;
serverCode = serverCode.replace(/import\.meta\.dirname/g, dirnameReplacement);

// Also fix the static path issue for production
serverCode = serverCode.replace(
  /path2\.resolve\(import\.meta\.dirname, "public"\)/g,
  `path2.resolve("${__dirname}", "dist", "public")`
);
serverCode = serverCode.replace(
  /path\.resolve\([^,]+, "public"\)/g,
  `path.resolve("${__dirname}", "dist", "public")`
);

// Write the fixed version
const fixedPath = join(__dirname, 'dist', 'index.fixed.js');
writeFileSync(fixedPath, serverCode);

console.log('✓ Fixed Node.js v18 compatibility issues');
console.log('✓ Starting production server...');

// Import and run the fixed version
await import(fixedPath);