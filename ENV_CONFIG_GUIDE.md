# Environment Variables Configuration Guide

## 🎯 Overview

This guide explains how to configure environment variables for the AI Commit Validator, both for local development and GitHub hosting.

## 🔧 Local Development Setup

### Option 1: Using .env.local (Recommended)

1. **Create `.env.local` file** (already created for you):
   ```bash
   OPENAI_API_KEY=your-actual-api-key
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_MAX_TOKENS=1000
   NODE_ENV=development
   LOG_LEVEL=debug
   ```

2. **Run your application:**
   ```bash
   npm start
   # or
   validate-commit
   ```

### Option 2: Using System Environment Variables

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-4o-mini"
validate-commit
```

**Linux/Mac (Bash):**
```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="gpt-4o-mini"
validate-commit
```

## 🚀 GitHub Hosting Setup

### Step 1: Add Repository Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

**Add these secrets:**

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `OPENAI_API_KEY` | `sk-proj-yK5fkpGl8jpF...` | Your OpenAI API key |
| `NPM_TOKEN` | `npm_xxxxxxxxxxxx` | For publishing (optional) |

### Step 2: Add Repository Variables

Switch to **Variables** tab and add:

| Variable Name | Value | Purpose |
|---------------|-------|---------|
| `OPENAI_MODEL` | `gpt-4o-mini` | AI model to use |
| `OPENAI_MAX_TOKENS` | `1000` | Maximum tokens per request |
| `LOG_LEVEL` | `info` | Logging level |
| `API_TIMEOUT` | `30000` | API timeout in milliseconds |

### Step 3: Environment-Specific Configuration

Create environments for different stages:

#### Development Environment
```yaml
Variables:
  OPENAI_MODEL: gpt-3.5-turbo
  LOG_LEVEL: debug
  OPENAI_MAX_TOKENS: 1500

Secrets:
  OPENAI_API_KEY: sk-proj-dev-key...
```

#### Production Environment
```yaml
Variables:
  OPENAI_MODEL: gpt-4o-mini
  LOG_LEVEL: error
  OPENAI_MAX_TOKENS: 1000

Secrets:
  OPENAI_API_KEY: sk-proj-prod-key...
```

## 🔍 Environment Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENAI_API_KEY` | Secret | *(required)* | Your OpenAI API key |
| `OPENAI_MODEL` | Variable | `gpt-4o-mini` | AI model to use |
| `OPENAI_MAX_TOKENS` | Variable | `1000` | Maximum tokens per request |
| `NODE_ENV` | Variable | `development` | Environment mode |
| `LOG_LEVEL` | Variable | `info` | Logging verbosity |
| `API_TIMEOUT` | Variable | `30000` | API timeout (milliseconds) |

## 🎛️ Configuration Priority

The application loads environment variables in this order:

1. **System environment variables** (highest priority)
2. **`.env.local`** (local development)
3. **`.env`** (default template)
4. **GitHub secrets/variables** (when running in Actions)

## ✅ Testing Your Configuration

### Local Testing

```bash
# Test with your local configuration
validate-commit

# Test with specific environment
NODE_ENV=production validate-commit
```

### GitHub Actions Testing

The workflow will automatically test your configuration when you push changes:

1. **Validates** all required environment variables
2. **Tests** OpenAI API connection
3. **Runs** integration tests
4. **Reports** any configuration issues

## 🔒 Security Best Practices

### ✅ Do's:
- ✅ Use `.env.local` for local development
- ✅ Add `.env*` to `.gitignore`
- ✅ Use GitHub secrets for sensitive data
- ✅ Use different API keys for different environments
- ✅ Validate environment variables on startup

### ❌ Don'ts:
- ❌ Never commit API keys to git
- ❌ Don't use production keys in development
- ❌ Don't expose secrets in logs
- ❌ Don't hardcode sensitive values in code

## 🐛 Troubleshooting

### Error: "OPENAI_API_KEY environment variable is required"

**Solutions:**
1. **Local:** Add key to `.env.local`
2. **GitHub:** Add key to repository secrets
3. **System:** Set environment variable in shell

### Error: "API connection failed"

**Check:**
1. ✅ API key is correct and active
2. ✅ You have OpenAI credits available
3. ✅ Network connection is working
4. ✅ API timeout is sufficient

### Error: "Invalid model specified"

**Solutions:**
1. Check available models in OpenAI documentation
2. Verify model name spelling
3. Ensure you have access to the model

## 📝 Quick Setup Checklist

### For Local Development:
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add your actual OpenAI API key
- [ ] Test with `validate-commit`

### For GitHub Hosting:
- [ ] Add `OPENAI_API_KEY` to repository secrets
- [ ] Add configuration variables
- [ ] Push changes to trigger workflow
- [ ] Check Actions tab for results

## 🆘 Support

If you need help:

1. **Check the Actions logs** in your repository
2. **Verify environment variable names** (case-sensitive)
3. **Test locally first** before pushing to GitHub
4. **Review the troubleshooting section** above

---

**Your environment is now configured!** 🎉

You can now use your AI Commit Validator both locally and on GitHub with proper environment variable management.