#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob').sync;

async function fixDuplicateImports(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;
    
    // Find and remove duplicate import lines
    const lines = content.split('\n');
    const seenImports = new Set();
    const cleanedLines = [];
    
    for (const line of lines) {
      // Check if it's an import from vitest
      if (line.includes("import") && line.includes("from 'vitest'")) {
        if (!seenImports.has(line.trim())) {
          seenImports.add(line.trim());
          cleanedLines.push(line);
        } else {
          modified = true;
          console.log(`  Removing duplicate: ${line.trim()}`);
        }
      } else {
        cleanedLines.push(line);
      }
    }
    
    if (modified) {
      content = cleanedLines.join('\n');
      await fs.writeFile(filePath, content);
      console.log(`✓ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`✗ ${filePath} - Error: ${error.message}`);
  }
}

async function main() {
  console.log('\nFixing duplicate imports...\n');
  
  // Find test files with duplicate imports
  const patterns = [
    'Athena/__tests__/**/*.test.ts',
    'Athena/__tests__/**/*.test.tsx',
    'services/**/*.test.ts',
    'services/**/*.test.js',
    'wasm-modules/**/*.test.ts',
    'wasm-modules/**/*.test.js'
  ];
  
  let files = [];
  for (const pattern of patterns) {
    const matches = glob(path.join('/workspaces/Athena', pattern));
    files.push(...matches);
  }
  
  // Process files
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (content.split("from 'vitest'").length > 2) {
      await fixDuplicateImports(file);
    }
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);