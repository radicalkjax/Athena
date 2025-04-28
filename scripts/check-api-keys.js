#!/usr/bin/env node
/**
 * API Key Validation Script for Athena
 * 
 * This script checks if the API keys for OpenAI, Claude, and DeepSeek are valid.
 * It reads the keys from the .env file and makes test requests to each API.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { promisify } = require('util');
const readline = require('readline');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Print banner
console.log(`${colors.blue}
  █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗ 
 ██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗
 ███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║
 ██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║
 ██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║
 ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝
${colors.reset}`);
console.log(`${colors.yellow}API Key Validation Tool${colors.reset}`);
console.log(`${colors.blue}============================================${colors.reset}\n`);

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), 'Athena', '.env');
  
  console.log(`${colors.blue}Looking for .env file at:${colors.reset} ${envPath}`);
  
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}✗ .env file not found!${colors.reset}`);
    console.log(`${colors.yellow}Creating a new .env file...${colors.reset}`);
    
    // Create a basic .env file
    const envContent = `# API Keys for AI Models
OPENAI_API_KEY=
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
`;
    fs.writeFileSync(envPath, envContent);
    console.log(`${colors.green}✓ Created new .env file${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ .env file found${colors.reset}`);
  }
  
  // Load the .env file
  const envConfig = dotenv.config({ path: envPath });
  
  if (envConfig.error) {
    console.log(`${colors.red}✗ Error loading .env file:${colors.reset}`, envConfig.error);
    return false;
  }
  
  console.log(`${colors.green}✓ .env file loaded successfully${colors.reset}\n`);
  return true;
}

/**
 * Check if an API key is present in environment variables
 */
function checkApiKeyPresent(keyName) {
  const key = process.env[keyName];
  if (!key) {
    console.log(`${colors.red}✗ ${keyName} not found in .env file${colors.reset}`);
    return false;
  }
  
  if (key === 'your_openai_api_key_here' || 
      key === 'your_claude_api_key_here' || 
      key === 'your_deepseek_api_key_here' ||
      key.trim() === '') {
    console.log(`${colors.red}✗ ${keyName} is set to a placeholder value${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✓ ${keyName} found${colors.reset}`);
  return true;
}

/**
 * Validate OpenAI API key by making a test request
 */
async function validateOpenAIKey(apiKey) {
  console.log(`${colors.blue}Testing OpenAI API key...${colors.reset}`);
  
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, this is a test message from Athena.' }],
        max_tokens: 10
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ OpenAI API key is valid${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ OpenAI API key validation failed with status:${colors.reset}`, response.status);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ OpenAI API key validation failed:${colors.reset}`, error.response?.data?.error?.message || error.message);
    return false;
  }
}

/**
 * Validate Claude API key by making a test request
 */
async function validateClaudeKey(apiKey) {
  console.log(`${colors.blue}Testing Claude API key...${colors.reset}`);
  
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Hello, this is a test message from Athena.' }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ Claude API key is valid${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Claude API key validation failed with status:${colors.reset}`, response.status);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Claude API key validation failed:${colors.reset}`, error.response?.data?.error?.message || error.message);
    return false;
  }
}

/**
 * Validate DeepSeek API key by making a test request
 */
async function validateDeepSeekKey(apiKey) {
  console.log(`${colors.blue}Testing DeepSeek API key...${colors.reset}`);
  
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello, this is a test message from Athena.' }],
        max_tokens: 10
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ DeepSeek API key is valid${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ DeepSeek API key validation failed with status:${colors.reset}`, response.status);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ DeepSeek API key validation failed:${colors.reset}`, error.response?.data?.error?.message || error.message);
    return false;
  }
}

/**
 * Update API key in .env file
 */
async function updateApiKey(keyName) {
  const envPath = path.join(process.cwd(), 'Athena', '.env');
  const newKey = await question(`${colors.yellow}Enter your ${keyName}:${colors.reset} `);
  
  if (!newKey || newKey.trim() === '') {
    console.log(`${colors.red}✗ No key provided. Skipping update.${colors.reset}`);
    return false;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if the key already exists in the file
  const keyRegex = new RegExp(`^${keyName}=.*$`, 'm');
  if (keyRegex.test(envContent)) {
    // Replace existing key
    envContent = envContent.replace(keyRegex, `${keyName}=${newKey}`);
  } else {
    // Add new key
    envContent += `\n${keyName}=${newKey}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`${colors.green}✓ Updated ${keyName} in .env file${colors.reset}`);
  
  // Update environment variable for current process
  process.env[keyName] = newKey;
  
  return true;
}

/**
 * Main function
 */
async function main() {
  try {
    // Load environment variables
    if (!loadEnvFile()) {
      return;
    }
    
    // Check and validate OpenAI API key
    let openaiKeyValid = false;
    if (checkApiKeyPresent('OPENAI_API_KEY')) {
      openaiKeyValid = await validateOpenAIKey(process.env.OPENAI_API_KEY);
    }
    
    if (!openaiKeyValid) {
      const updateKey = await question(`${colors.yellow}Would you like to update your OpenAI API key? (y/n)${colors.reset} `);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('OPENAI_API_KEY')) {
          openaiKeyValid = await validateOpenAIKey(process.env.OPENAI_API_KEY);
        }
      }
    }
    
    console.log(); // Empty line for spacing
    
    // Check and validate Claude API key
    let claudeKeyValid = false;
    if (checkApiKeyPresent('CLAUDE_API_KEY')) {
      claudeKeyValid = await validateClaudeKey(process.env.CLAUDE_API_KEY);
    }
    
    if (!claudeKeyValid) {
      const updateKey = await question(`${colors.yellow}Would you like to update your Claude API key? (y/n)${colors.reset} `);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('CLAUDE_API_KEY')) {
          claudeKeyValid = await validateClaudeKey(process.env.CLAUDE_API_KEY);
        }
      }
    }
    
    console.log(); // Empty line for spacing
    
    // Check and validate DeepSeek API key
    let deepseekKeyValid = false;
    if (checkApiKeyPresent('DEEPSEEK_API_KEY')) {
      deepseekKeyValid = await validateDeepSeekKey(process.env.DEEPSEEK_API_KEY);
    }
    
    if (!deepseekKeyValid) {
      const updateKey = await question(`${colors.yellow}Would you like to update your DeepSeek API key? (y/n)${colors.reset} `);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('DEEPSEEK_API_KEY')) {
          deepseekKeyValid = await validateDeepSeekKey(process.env.DEEPSEEK_API_KEY);
        }
      }
    }
    
    console.log(); // Empty line for spacing
    
    // Summary
    console.log(`${colors.blue}============================================${colors.reset}`);
    console.log(`${colors.yellow}API Key Validation Summary:${colors.reset}`);
    console.log(`OpenAI API: ${openaiKeyValid ? colors.green + '✓ Valid' : colors.red + '✗ Invalid or missing'}`);
    console.log(`Claude API: ${claudeKeyValid ? colors.green + '✓ Valid' : colors.red + '✗ Invalid or missing'}`);
    console.log(`DeepSeek API: ${deepseekKeyValid ? colors.green + '✓ Valid' : colors.red + '✗ Invalid or missing'}`);
    console.log(colors.reset);
    
    if (openaiKeyValid || claudeKeyValid || deepseekKeyValid) {
      console.log(`${colors.green}You have at least one valid API key. You can now use Athena with the following models:${colors.reset}`);
      if (openaiKeyValid) console.log(`- OpenAI models (GPT-4, GPT-3.5)`);
      if (claudeKeyValid) console.log(`- Claude models (Claude 3 Opus, Sonnet, Haiku)`);
      if (deepseekKeyValid) console.log(`- DeepSeek models (DeepSeek Coder, DeepSeek Chat)`);
    } else {
      console.log(`${colors.red}No valid API keys found. You need at least one valid API key to use Athena.${colors.reset}`);
      console.log(`${colors.yellow}Please update your API keys in the .env file or through the Settings screen in the application.${colors.reset}`);
    }
    
    console.log(`${colors.blue}============================================${colors.reset}`);
    console.log(`${colors.yellow}Next steps:${colors.reset}`);
    console.log(`1. Run ${colors.blue}cd Athena && npm run start:web${colors.reset} to start the web application`);
    console.log(`2. Or run ${colors.blue}cd Athena && npx expo start${colors.reset} to start the Expo development server`);
    console.log(`${colors.blue}============================================${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}An error occurred:${colors.reset}`, error);
  } finally {
    rl.close();
  }
}

// Run the main function
main();
