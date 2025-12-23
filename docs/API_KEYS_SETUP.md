# API Keys Setup Guide

This guide will help you obtain and configure the required API keys for Athena v2.

## Required API Keys

Athena v2 uses multiple AI providers for comprehensive malware analysis:

1. **Claude (Anthropic)** - Advanced code analysis and threat detection
2. **DeepSeek** - Specialized deep learning analysis
3. **OpenAI** - GPT-based pattern recognition

## Obtaining API Keys

### 1. Claude API Key (Anthropic)

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy your API key (starts with `sk-ant-`)

**Pricing**: Pay-per-use, see [Anthropic Pricing](https://www.anthropic.com/pricing)

### 2. DeepSeek API Key

1. Visit [DeepSeek Platform](https://platform.deepseek.com/)
2. Create an account or sign in
3. Go to "API Keys" in your dashboard
4. Generate a new API key
5. Copy your API key

**Pricing**: Check DeepSeek platform for current rates

### 3. OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to [API Keys page](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy your API key (starts with `sk-`)

**Pricing**: Pay-per-use, see [OpenAI Pricing](https://openai.com/pricing)

## Configuration

### Step 1: Edit the .env file

```bash
cd /Users/radicalkjax/Athena
nano .env  # or use your preferred editor
```

### Step 2: Add your API keys

```env
# AI Provider Keys
CLAUDE_API_KEY=sk-ant-your-key-here
DEEPSEEK_API_KEY=your-deepseek-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

### Step 3: Restart the backend

```bash
docker-compose -f docker-compose.dev.yml restart api
```

### Step 4: Verify configuration

```bash
node test-api-keys.js
```

You should see:

```text
✅ CLAUDE_API_KEY is configured
✅ DEEPSEEK_API_KEY is configured
✅ OPENAI_API_KEY is configured
```

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

## Cost Optimization

1. **Use caching** - Athena caches results in Redis
2. **Batch requests** - Process multiple files together
3. **Monitor usage** - Check provider dashboards regularly
4. **Set alerts** - Configure spending alerts in each platform

## Next Steps

After configuring API keys:

1. Test file analysis: Upload a test file through the UI
2. Monitor logs: `docker logs -f athena-api-dev`
3. Check metrics: Visit <http://localhost:9091> (Prometheus)

For support, check the [Issues page](https://github.com/anthropics/claude-code/issues).
