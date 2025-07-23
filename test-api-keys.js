#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testAPIKeys() {
    console.log('🔍 Testing API Keys Configuration...\n');
    
    const results = {
        claude: false,
        deepseek: false,
        openai: false
    };
    
    // Check if keys are set
    if (!process.env.CLAUDE_API_KEY) {
        console.log('❌ CLAUDE_API_KEY is not set in .env file');
    } else {
        console.log('✅ CLAUDE_API_KEY is configured');
        results.claude = true;
    }
    
    if (!process.env.DEEPSEEK_API_KEY) {
        console.log('❌ DEEPSEEK_API_KEY is not set in .env file');
    } else {
        console.log('✅ DEEPSEEK_API_KEY is configured');
        results.deepseek = true;
    }
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('❌ OPENAI_API_KEY is not set in .env file');
    } else {
        console.log('✅ OPENAI_API_KEY is configured');
        results.openai = true;
    }
    
    console.log('\n📡 Testing API Health...\n');
    
    try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/health`);
        const health = response.data;
        
        console.log('API Status:', health.status);
        console.log('\nProvider Health:');
        
        Object.entries(health.providers).forEach(([provider, status]) => {
            const icon = status.healthy ? '✅' : '❌';
            console.log(`${icon} ${provider}: ${status.healthy ? 'Healthy' : 'Not Available'}`);
            if (status.errors && status.errors.length > 0) {
                console.log(`   Error: ${status.errors[0]}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to connect to API:', error.message);
        console.log('\nMake sure the backend is running:');
        console.log('  cd /Users/radicalkjax/Athena');
        console.log('  docker-compose -f docker-compose.dev.yml up -d');
    }
    
    console.log('\n📝 Summary:');
    const configuredCount = Object.values(results).filter(v => v).length;
    console.log(`${configuredCount}/3 API keys configured`);
    
    if (configuredCount < 3) {
        console.log('\nTo add API keys:');
        console.log('1. Edit the .env file');
        console.log('2. Add your API keys (see .env.example for help)');
        console.log('3. Restart the Docker containers:');
        console.log('   docker-compose -f docker-compose.dev.yml restart api');
    }
}

testAPIKeys();