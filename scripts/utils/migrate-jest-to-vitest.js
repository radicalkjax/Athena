#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Patterns to replace
const replacements = [
  // Import statements
  { pattern: /from ['"]jest['"]/g, replacement: 'from \'vitest\'' },
  { pattern: /from ['"]@jest\/globals['"]/g, replacement: 'from \'vitest\'' },
  { pattern: /import jest from ['"]jest['"]/g, replacement: 'import { vi } from \'vitest\'' },
  
  // Add vitest imports if not present
  { 
    pattern: /^((?!import.*vitest)[\s\S])*?(describe|it|test|expect|beforeEach|afterEach|beforeAll|afterAll)\(/m,
    replacement: (match, prefix, method) => {
      if (!prefix.includes('import') || !prefix.includes('vitest')) {
        return `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';\n${match}`;
      }
      return match;
    }
  },
  
  // Jest mock functions
  { pattern: /jest\.fn\(/g, replacement: 'vi.fn(' },
  { pattern: /jest\.mock\(/g, replacement: 'vi.mock(' },
  { pattern: /jest\.mocked\(/g, replacement: 'vi.mocked(' },
  { pattern: /jest\.spyOn\(/g, replacement: 'vi.spyOn(' },
  { pattern: /jest\.clearAllMocks\(/g, replacement: 'vi.clearAllMocks(' },
  { pattern: /jest\.resetAllMocks\(/g, replacement: 'vi.resetAllMocks(' },
  { pattern: /jest\.restoreAllMocks\(/g, replacement: 'vi.restoreAllMocks(' },
  
  // Timer functions
  { pattern: /jest\.useFakeTimers\(/g, replacement: 'vi.useFakeTimers(' },
  { pattern: /jest\.useRealTimers\(/g, replacement: 'vi.useRealTimers(' },
  { pattern: /jest\.advanceTimersByTime\(/g, replacement: 'vi.advanceTimersByTime(' },
  { pattern: /jest\.runAllTimers\(/g, replacement: 'vi.runAllTimers(' },
  { pattern: /jest\.runOnlyPendingTimers\(/g, replacement: 'vi.runOnlyPendingTimers(' },
  
  // Module mocking
  { pattern: /jest\.unmock\(/g, replacement: 'vi.unmock(' },
  { pattern: /jest\.doMock\(/g, replacement: 'vi.doMock(' },
  { pattern: /jest\.dontMock\(/g, replacement: 'vi.dontMock(' },
  { pattern: /jest\.setMock\(/g, replacement: 'vi.setMock(' },
  { pattern: /jest\.requireActual\(/g, replacement: 'vi.importActual(' },
  { pattern: /jest\.requireMock\(/g, replacement: 'vi.importMock(' },
  
  // Other utilities
  { pattern: /jest\.setTimeout\(/g, replacement: 'vi.setTimeout(' },
  { pattern: /jest\.clearAllTimers\(/g, replacement: 'vi.clearAllTimers(' },
  { pattern: /jest\.getTimerCount\(/g, replacement: 'vi.getTimerCount(' },
  { pattern: /jest\.now\(/g, replacement: 'Date.now(' },
  
  // Fix useFakeTimers with options
  { 
    pattern: /vi\.useFakeTimers\(\s*{\s*doNotFake:\s*\[.*?\]\s*}\s*\)/g, 
    replacement: 'vi.useFakeTimers({ shouldAdvanceTime: true })' 
  },
];

async function migrateFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    
    // Apply replacements
    for (const { pattern, replacement } of replacements) {
      content = content.replace(pattern, replacement);
    }
    
    // Check if file was modified
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✅ Migrated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  Skipped (no changes): ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

async function findTestFiles(dir) {
  const testFiles = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other directories
        if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        testFiles.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return testFiles;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node migrate-jest-to-vitest.js <path-to-test-file-or-directory>');
    console.log('Example: node migrate-jest-to-vitest.js ./src/__tests__');
    process.exit(1);
  }
  
  const targetPath = path.resolve(args[0]);
  
  try {
    const stat = await fs.stat(targetPath);
    
    let filesToMigrate = [];
    
    if (stat.isDirectory()) {
      console.log(`🔍 Searching for test files in: ${targetPath}`);
      filesToMigrate = await findTestFiles(targetPath);
      console.log(`📁 Found ${filesToMigrate.length} test files`);
    } else if (stat.isFile()) {
      filesToMigrate = [targetPath];
    } else {
      console.error('Target path is neither a file nor a directory');
      process.exit(1);
    }
    
    let migratedCount = 0;
    
    for (const file of filesToMigrate) {
      const migrated = await migrateFile(file);
      if (migrated) migratedCount++;
    }
    
    console.log(`\n✨ Migration complete! ${migratedCount} of ${filesToMigrate.length} files migrated.`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);