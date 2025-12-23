# API Keys Setup Guide

**Last Updated:** December 22, 2025

This guide will help you obtain and configure the required API keys for Athena v2.

## Required API Keys

Athena v2 supports **6 AI providers** for comprehensive malware analysis. You need at least one configured:

| Provider | Primary Use | Required |
|----------|-------------|----------|
| Claude (Anthropic) | Advanced code analysis and threat detection | Recommended |
| OpenAI | GPT-based pattern recognition | Optional |
| DeepSeek | Specialized deep learning analysis | Optional |
| Gemini (Google) | Multi-modal analysis | Optional |
| Mistral | Fast inference analysis | Optional |
| Groq | High-speed inference | Optional |

## Obtaining API Keys

### 1. Claude API Key (Anthropic)

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy your API key (starts with `sk-ant-`)

**Pricing**: Pay-per-use, see [Anthropic Pricing](https://www.anthropic.com/pricing)

### 2. OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to [API Keys page](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy your API key (starts with `sk-`)

**Pricing**: Pay-per-use, see [OpenAI Pricing](https://openai.com/pricing)

### 3. DeepSeek API Key

1. Visit [DeepSeek Platform](https://platform.deepseek.com/)
2. Create an account or sign in
3. Go to "API Keys" in your dashboard
4. Generate a new API key
5. Copy your API key

**Pricing**: Check DeepSeek platform for current rates

### 4. Gemini API Key (Google)

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select or create a Google Cloud project
5. Copy your API key

**Pricing**: Free tier available, see [Gemini Pricing](https://ai.google.dev/pricing)

### 5. Mistral API Key

1. Visit [Mistral Console](https://console.mistral.ai/)
2. Create an account or sign in
3. Go to "API Keys" section
4. Click "Create new key"
5. Copy your API key

**Pricing**: Pay-per-use, see [Mistral Pricing](https://mistral.ai/pricing/)

### 6. Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Create an account or sign in
3. Navigate to "API Keys"
4. Click "Create API Key"
5. Copy your API key

**Pricing**: Free tier available, see [Groq Pricing](https://groq.com/pricing/)

## Configuration

### Step 1: Edit the .env file

```bash
cd /Users/kali/Athena/Athena
nano .env  # or use your preferred editor
```

### Step 2: Add your API keys

```env
# AI Provider Keys (at least one required)
CLAUDE_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-openai-key-here
DEEPSEEK_API_KEY=your-deepseek-key-here
GEMINI_API_KEY=your-gemini-key-here
MISTRAL_API_KEY=your-mistral-key-here
GROQ_API_KEY=your-groq-key-here

# Optional: Redis for caching
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 3: Launch the Application

```bash
# Development mode
cd athena-v2 && npm run tauri:dev

# Or production build
cd athena-v2 && npm run tauri:build
```

### Step 4: Verify configuration

The application will show provider status in the AI Provider Status panel:

- Green indicator = Provider configured and healthy
- Yellow indicator = Provider configured but rate limited
- Red indicator = Provider not configured or erroring

## Security Best Practices

1. **Never commit API keys to version control**
   - The `.env` file is already in `.gitignore`
   - Use `.env.example` as a template

2. **Rotate keys regularly**
   - Set up key rotation schedules
   - Monitor usage for anomalies

3. **Set usage limits**
   - Configure spending limits in each provider's dashboard
   - Monitor API usage regularly

4. **Use environment-specific keys**
   - Different keys for development/staging/production
   - Restrict production keys to specific IPs if possible

## Provider Features

| Provider | Streaming | Tools | Circuit Breaker | Retry |
|----------|-----------|-------|-----------------|-------|
| Claude | Yes | Yes | Yes | Exponential |
| OpenAI | Yes | Yes | Yes | Exponential |
| DeepSeek | Yes | No | Yes | Exponential |
| Gemini | Yes | Yes | Yes | Exponential |
| Mistral | Yes | Yes | Yes | Exponential |
| Groq | Yes | No | Yes | Exponential |

## Troubleshooting

### API Key Not Working

1. Check for extra spaces or newlines in the .env file
2. Ensure the key hasn't expired or been revoked
3. Verify you have billing set up with the provider
4. Check API rate limits

### Provider-Specific Issues

**Claude errors:**
- "x-api-key header is required" - Key not set in .env
- "Invalid API key" - Check key format (should start with `sk-ant-`)

**OpenAI errors:**
- "You didn't provide an API key" - Key not set in .env
- "Incorrect API key provided" - Verify key is correct

**DeepSeek errors:**
- "Authentication failed" - Check key validity

**Gemini errors:**
- "API key not valid" - Ensure key is from AI Studio
- "Quota exceeded" - Check your free tier limits

**Mistral errors:**
- "Unauthorized" - Verify key is active
- "Rate limited" - Wait and retry

**Groq errors:**
- "Invalid API Key" - Regenerate key in console

## Cost Optimization

1. **Use caching** - Athena caches results to reduce API calls
2. **Use ensemble mode** - Get consensus from multiple providers
3. **Monitor usage** - Check provider dashboards regularly
4. **Set alerts** - Configure spending alerts in each platform
5. **Use Groq for speed** - Fast inference for initial triage

## Next Steps

After configuring API keys:

1. Launch the application: `cd athena-v2 && npm run tauri:dev`
2. Upload a test file through the UI
3. Check the AI Provider Status panel for provider health
4. Run an analysis to verify connectivity

For support, check the [Issues page](https://github.com/anthropics/claude-code/issues).
