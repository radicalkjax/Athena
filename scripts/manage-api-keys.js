#!/usr/bin/env node

/**
 * API Key Management CLI
 * Usage: node manage-api-keys.js <command> [options]
 * 
 * Commands:
 *   create <role> [userId] - Create a new API key
 *   list [userId]          - List API keys
 *   revoke <keyOrId>       - Revoke an API key
 *   validate <key>         - Validate an API key
 */

const { program } = require('commander');
const apiKeyRepository = require('../services/database/apiKeyRepository');
const { testConnection } = require('../services/database/connection');
const { logger } = require('../services/logger');

// Load environment variables
require('dotenv').config();

program
  .name('manage-api-keys')
  .description('CLI tool for managing Athena API keys')
  .version('1.0.0');

program
  .command('create <role> [userId]')
  .description('Create a new API key')
  .option('-d, --description <desc>', 'Description for the key')
  .option('-e, --expires <days>', 'Expiration in days', parseInt)
  .option('-p, --permissions <perms...>', 'Custom permissions (e.g., admin:* analysis:read)')
  .action(async (role, userId, options) => {
    try {
      await ensureConnection();
      
      // Default permissions based on role
      let permissions = options.permissions || [];
      if (permissions.length === 0) {
        switch (role) {
          case 'admin':
            permissions = ['admin:*', 'analysis:*', 'system:*'];
            break;
          case 'analysis':
            permissions = ['analysis:*', 'upload:*', 'wasm:*'];
            break;
          case 'client':
            permissions = ['analysis:read', 'workflow:execute'];
            break;
          default:
            console.error('Invalid role. Use: admin, analysis, or client');
            process.exit(1);
        }
      }
      
      const keyData = {
        userId: userId || 'system',
        role: role,
        permissions: permissions,
        description: options.description || `${role} API key`,
        expiresIn: options.expires ? options.expires * 86400 : null
      };
      
      const result = await apiKeyRepository.createApiKey(keyData);
      
      console.log('\n✅ API Key created successfully!\n');
      console.log('Key ID:', result.id);
      console.log('Role:', result.role);
      console.log('Prefix:', result.keyPrefix);
      console.log('Created:', result.createdAt);
      if (result.expiresAt) {
        console.log('Expires:', result.expiresAt);
      }
      console.log('\n🔑 API Key (save this securely, it won\'t be shown again):');
      console.log(`\n${result.apiKey}\n`);
      console.log('Add to your .env file or use in X-API-Key header');
      
    } catch (error) {
      console.error('Error creating API key:', error.message);
      process.exit(1);
    }
  });

program
  .command('list [userId]')
  .description('List API keys')
  .option('-a, --all', 'Show all keys (admin only)')
  .action(async (userId, options) => {
    try {
      await ensureConnection();
      
      if (options.all && !userId) {
        console.log('Listing all keys requires admin privileges');
        // In production, check admin permissions
        userId = null;
      }
      
      const keys = await apiKeyRepository.listUserApiKeys(userId || 'system');
      
      if (keys.length === 0) {
        console.log('No API keys found');
        return;
      }
      
      console.log('\nAPI Keys:\n');
      keys.forEach(key => {
        console.log(`ID: ${key.id}`);
        console.log(`  Prefix: ${key.key_prefix}`);
        console.log(`  Role: ${key.role}`);
        console.log(`  Active: ${key.is_active ? '✅' : '❌'}`);
        console.log(`  Created: ${key.created_at}`);
        console.log(`  Last Used: ${key.last_used_at || 'Never'}`);
        console.log(`  Usage Count: ${key.usage_count}`);
        if (key.expires_at) {
          console.log(`  Expires: ${key.expires_at}`);
        }
        console.log('');
      });
      
    } catch (error) {
      console.error('Error listing API keys:', error.message);
      process.exit(1);
    }
  });

program
  .command('revoke <keyOrId>')
  .description('Revoke an API key')
  .option('-r, --reason <reason>', 'Reason for revocation', 'Manual revocation')
  .action(async (keyOrId, options) => {
    try {
      await ensureConnection();
      
      await apiKeyRepository.revokeApiKey(keyOrId, options.reason);
      console.log('✅ API key revoked successfully');
      
    } catch (error) {
      console.error('Error revoking API key:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate <key>')
  .description('Validate an API key')
  .action(async (key) => {
    try {
      await ensureConnection();
      
      const user = await apiKeyRepository.validateApiKey(key);
      
      if (user) {
        console.log('\n✅ Valid API Key\n');
        console.log('User ID:', user.id);
        console.log('Role:', user.role);
        console.log('Permissions:', user.permissions.join(', '));
        if (user.rateLimit) {
          console.log('Rate Limit:', user.rateLimit, 'requests/minute');
        }
      } else {
        console.log('\n❌ Invalid API Key');
      }
      
    } catch (error) {
      console.error('Error validating API key:', error.message);
      process.exit(1);
    }
  });

async function ensureConnection() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Database connection failed');
    console.error('Make sure PostgreSQL is running and configured in .env');
    process.exit(1);
  }
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}