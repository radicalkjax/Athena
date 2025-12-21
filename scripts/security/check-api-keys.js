#!/usr/bin/env node
/**
 * API Key Validation Script for Athena - Enhanced Edition
 * 
 * This script checks if the API keys for OpenAI, Claude, and DeepSeek are valid.
 * Features beautiful transgender flag colors and enhanced visual feedback.
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
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
};

// Transgender flag colors
const trans = {
  blue: '\x1b[38;2;91;206;250m',    // Light Blue
  pink: '\x1b[38;2;245;169;184m',   // Pink
  white: '\x1b[38;2;255;255;255m',  // White
};

// Unicode characters
const symbols = {
  check: '✓',
  cross: '✗',
  warning: '⚠',
  key: '🔑',
  lock: '🔒',
  unlock: '🔓',
  rocket: '🚀',
  sparkles: '✨',
  shield: '🛡️',
  gear: '⚙',
  package: '📦',
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Spinner animation
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;
let spinnerInterval;

function startSpinner(message) {
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${trans.blue}${spinnerFrames[spinnerIndex]}${colors.reset} ${message}`);
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  }, 100);
}

function stopSpinner(success = true, message = '') {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
    if (message) {
      const symbol = success ? `${colors.green}${symbols.check}` : `${colors.red}${symbols.cross}`;
      console.log(`${symbol}${colors.reset} ${message}`);
    }
  }
}

// Progress bar
function showProgress(current, total, label = '') {
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  const percentage = Math.round((current / total) * 100);
  process.stdout.write(`\r${trans.pink}[${trans.blue}${bar}${trans.pink}]${colors.reset} ${trans.white}${percentage}%${colors.reset} ${label}`);
  if (current === total) console.log(); // New line at completion
}

// Print enhanced banner
function printBanner() {
  console.log('');
  console.log(`${trans.blue}  █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗ ${colors.reset}`);
  console.log(`${trans.pink} ██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗${colors.reset}`);
  console.log(`${trans.white} ███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║${colors.reset}`);
  console.log(`${trans.pink} ██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║${colors.reset}`);
  console.log(`${trans.blue} ██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║${colors.reset}`);
  console.log(`${trans.white} ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝${colors.reset}`);
  console.log('');
  console.log(`${trans.pink}${colors.bold}API Key Validation Tool${colors.reset}`);
  console.log(`${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${trans.white}🏳️‍⚧️ Secure your AI services ${trans.pink}♥${trans.white} Validate with pride 🏳️‍⚧️${colors.reset}`);
  console.log(`${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), 'Athena', '.env');
  
  console.log(`${trans.white}${symbols.gear} Looking for environment file...${colors.reset}`);
  
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}${symbols.cross} .env file not found!${colors.reset}`);
    console.log(`${colors.yellow}${symbols.warning} Creating a new .env file...${colors.reset}`);
    
    // Create a basic .env file
    const envContent = `# API Keys for AI Models
OPENAI_API_KEY=
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=

# Additional Configuration
NODE_ENV=development
PORT=3000
`;
    fs.writeFileSync(envPath, envContent);
    console.log(`${colors.green}${symbols.check} Created new .env file${colors.reset}`);
  } else {
    console.log(`${colors.green}${symbols.check} Found .env file at: ${colors.dim}${envPath}${colors.reset}`);
  }
  
  // Load the .env file
  const envConfig = dotenv.config({ path: envPath });
  
  if (envConfig.error) {
    console.log(`${colors.red}${symbols.cross} Error loading .env file:${colors.reset}`, envConfig.error);
    return false;
  }
  
  console.log(`${colors.green}${symbols.check} Environment loaded successfully${colors.reset}\n`);
  return true;
}

/**
 * Check if an API key is present in environment variables
 */
function checkApiKeyPresent(keyName, serviceName) {
  const key = process.env[keyName];
  const icon = keyName.includes('OPENAI') ? '🤖' : keyName.includes('CLAUDE') ? '🧠' : '🔮';
  
  console.log(`${trans.white}${icon} Checking ${serviceName}...${colors.reset}`);
  
  if (!key) {
    console.log(`  ${colors.red}${symbols.cross} ${keyName} not found${colors.reset}`);
    return false;
  }
  
  if (key === 'your_openai_api_key_here' || 
      key === 'your_claude_api_key_here' || 
      key === 'your_deepseek_api_key_here' ||
      key.trim() === '') {
    console.log(`  ${colors.yellow}${symbols.warning} ${keyName} contains placeholder${colors.reset}`);
    return false;
  }
  
  // Mask the key for security
  const maskedKey = key.substring(0, 8) + '...' + key.substring(key.length - 4);
  console.log(`  ${colors.green}${symbols.check} Found key: ${colors.dim}${maskedKey}${colors.reset}`);
  return true;
}

/**
 * Validate OpenAI API key by making a test request
 */
async function validateOpenAIKey(apiKey) {
  startSpinner('Validating OpenAI API key...');
  
  try {
    const startTime = Date.now();
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
        },
        timeout: 10000
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      stopSpinner(true, `OpenAI API validated (${responseTime}ms)`);
      
      // Show model info
      if (response.data?.model) {
        console.log(`  ${colors.dim}Model: ${response.data.model}${colors.reset}`);
      }
      if (response.data?.usage) {
        console.log(`  ${colors.dim}Test tokens used: ${response.data.usage.total_tokens}${colors.reset}`);
      }
      return true;
    } else {
      stopSpinner(false, `OpenAI API returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    stopSpinner(false, `OpenAI API validation failed`);
    console.log(`  ${colors.red}${colors.dim}Error: ${errorMsg}${colors.reset}`);
    return false;
  }
}

/**
 * Validate Claude API key by making a test request
 */
async function validateClaudeKey(apiKey) {
  startSpinner('Validating Claude API key...');
  
  try {
    const startTime = Date.now();
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
        },
        timeout: 10000
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      stopSpinner(true, `Claude API validated (${responseTime}ms)`);
      
      // Show model info
      if (response.data?.model) {
        console.log(`  ${colors.dim}Model: ${response.data.model}${colors.reset}`);
      }
      if (response.data?.usage) {
        console.log(`  ${colors.dim}Test tokens used: ${response.data.usage.input_tokens + response.data.usage.output_tokens}${colors.reset}`);
      }
      return true;
    } else {
      stopSpinner(false, `Claude API returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    stopSpinner(false, `Claude API validation failed`);
    console.log(`  ${colors.red}${colors.dim}Error: ${errorMsg}${colors.reset}`);
    return false;
  }
}

/**
 * Validate DeepSeek API key by making a test request
 */
async function validateDeepSeekKey(apiKey) {
  startSpinner('Validating DeepSeek API key...');
  
  try {
    const startTime = Date.now();
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
        },
        timeout: 10000
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      stopSpinner(true, `DeepSeek API validated (${responseTime}ms)`);
      
      // Show model info
      if (response.data?.model) {
        console.log(`  ${colors.dim}Model: ${response.data.model}${colors.reset}`);
      }
      if (response.data?.usage) {
        console.log(`  ${colors.dim}Test tokens used: ${response.data.usage.total_tokens}${colors.reset}`);
      }
      return true;
    } else {
      stopSpinner(false, `DeepSeek API returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    stopSpinner(false, `DeepSeek API validation failed`);
    console.log(`  ${colors.red}${colors.dim}Error: ${errorMsg}${colors.reset}`);
    return false;
  }
}

/**
 * Update API key in .env file with password masking
 */
async function updateApiKey(keyName, serviceName) {
  console.log(`\n${trans.white}${symbols.key} Update ${serviceName} API Key${colors.reset}`);
  console.log(`${trans.pink}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const envPath = path.join(process.cwd(), 'Athena', '.env');
  const newKey = await question(`${colors.yellow}Enter your ${serviceName} API key: ${colors.reset}`);
  
  if (!newKey || newKey.trim() === '') {
    console.log(`${colors.red}${symbols.cross} No key provided. Skipping update.${colors.reset}`);
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
  
  // Show masked key for confirmation
  const maskedKey = newKey.substring(0, 8) + '...' + newKey.substring(newKey.length - 4);
  console.log(`${colors.green}${symbols.check} Updated ${keyName}: ${colors.dim}${maskedKey}${colors.reset}`);
  
  // Update environment variable for current process
  process.env[keyName] = newKey;
  
  return true;
}

/**
 * Show validation summary with visual report
 */
function showSummary(results) {
  console.log(`\n${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${trans.pink}${symbols.shield} ${colors.bold}API Key Validation Summary${colors.reset}`);
  console.log(`${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  const services = [
    { name: 'OpenAI', icon: '🤖', valid: results.openai },
    { name: 'Claude', icon: '🧠', valid: results.claude },
    { name: 'DeepSeek', icon: '🔮', valid: results.deepseek }
  ];
  
  services.forEach(service => {
    const status = service.valid 
      ? `${colors.green}${symbols.unlock} Active${colors.reset}` 
      : `${colors.red}${symbols.lock} Inactive${colors.reset}`;
    console.log(`${service.icon} ${service.name}: ${status}`);
  });
  
  const validCount = Object.values(results).filter(v => v).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n${trans.white}${symbols.package} Service Coverage: ${validCount}/${totalCount}${colors.reset}`);
  
  // Progress bar for API coverage
  showProgress(validCount, totalCount, 'API Coverage');
  
  if (validCount > 0) {
    console.log(`\n${colors.green}${symbols.sparkles} Available AI Models:${colors.reset}`);
    if (results.openai) {
      console.log(`  ${colors.cyan}• GPT-4 & GPT-3.5 Turbo${colors.reset}`);
      console.log(`    ${colors.dim}Best for: General tasks, code generation${colors.reset}`);
    }
    if (results.claude) {
      console.log(`  ${colors.magenta}• Claude 3 (Opus, Sonnet, Haiku)${colors.reset}`);
      console.log(`    ${colors.dim}Best for: Analysis, long contexts${colors.reset}`);
    }
    if (results.deepseek) {
      console.log(`  ${colors.yellow}• DeepSeek Coder & Chat${colors.reset}`);
      console.log(`    ${colors.dim}Best for: Code analysis, technical tasks${colors.reset}`);
    }
  } else {
    console.log(`\n${colors.red}${symbols.warning} No valid API keys found${colors.reset}`);
    console.log(`${colors.yellow}You need at least one API key to use Athena.${colors.reset}`);
  }
}

/**
 * Show next steps
 */
function showNextSteps() {
  console.log(`\n${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${trans.pink}${symbols.rocket} ${colors.bold}Next Steps${colors.reset}`);
  console.log(`${trans.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  console.log(`1. ${colors.cyan}./scripts/run.sh${colors.reset} - Start Athena with enhanced UI`);
  console.log(`2. ${colors.cyan}./scripts/run.sh update${colors.reset} - Update all dependencies`);
  console.log(`3. ${colors.cyan}./scripts/run.sh help${colors.reset} - See all available commands`);
  
  console.log(`\n${trans.white}${symbols.sparkles} Happy analyzing with Athena! ${symbols.sparkles}${colors.reset}\n`);
}

/**
 * Main function
 */
async function main() {
  try {
    printBanner();
    
    // Load environment variables
    if (!loadEnvFile()) {
      return;
    }
    
    // Results object
    const results = {
      openai: false,
      claude: false,
      deepseek: false
    };
    
    // Check and validate OpenAI API key
    console.log(`${trans.blue}${colors.bold}OpenAI API Configuration${colors.reset}`);
    console.log(`${trans.pink}━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (checkApiKeyPresent('OPENAI_API_KEY', 'OpenAI')) {
      results.openai = await validateOpenAIKey(process.env.OPENAI_API_KEY);
    }
    
    if (!results.openai) {
      const updateKey = await question(`\n${colors.yellow}Would you like to update your OpenAI API key? (y/n) ${colors.reset}`);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('OPENAI_API_KEY', 'OpenAI')) {
          results.openai = await validateOpenAIKey(process.env.OPENAI_API_KEY);
        }
      }
    }
    
    console.log(''); // Spacing
    
    // Check and validate Claude API key
    console.log(`${trans.blue}${colors.bold}Claude API Configuration${colors.reset}`);
    console.log(`${trans.pink}━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (checkApiKeyPresent('CLAUDE_API_KEY', 'Claude')) {
      results.claude = await validateClaudeKey(process.env.CLAUDE_API_KEY);
    }
    
    if (!results.claude) {
      const updateKey = await question(`\n${colors.yellow}Would you like to update your Claude API key? (y/n) ${colors.reset}`);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('CLAUDE_API_KEY', 'Claude')) {
          results.claude = await validateClaudeKey(process.env.CLAUDE_API_KEY);
        }
      }
    }
    
    console.log(''); // Spacing
    
    // Check and validate DeepSeek API key
    console.log(`${trans.blue}${colors.bold}DeepSeek API Configuration${colors.reset}`);
    console.log(`${trans.pink}━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (checkApiKeyPresent('DEEPSEEK_API_KEY', 'DeepSeek')) {
      results.deepseek = await validateDeepSeekKey(process.env.DEEPSEEK_API_KEY);
    }
    
    if (!results.deepseek) {
      const updateKey = await question(`\n${colors.yellow}Would you like to update your DeepSeek API key? (y/n) ${colors.reset}`);
      if (updateKey.toLowerCase() === 'y') {
        if (await updateApiKey('DEEPSEEK_API_KEY', 'DeepSeek')) {
          results.deepseek = await validateDeepSeekKey(process.env.DEEPSEEK_API_KEY);
        }
      }
    }
    
    // Show summary
    showSummary(results);
    showNextSteps();
    
  } catch (error) {
    stopSpinner(false);
    console.error(`\n${colors.red}${symbols.cross} An error occurred:${colors.reset}`, error.message);
    console.log(`${colors.dim}${error.stack}${colors.reset}`);
  } finally {
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  stopSpinner(false);
  console.log(`\n\n${colors.yellow}${symbols.warning} Operation cancelled${colors.reset}`);
  process.exit(0);
});

// Run the main function
main();