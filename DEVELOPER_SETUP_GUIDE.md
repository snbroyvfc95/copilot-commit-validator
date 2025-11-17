# Developer Setup Guide - AI Commit Validator

## 🎯 Complete Configuration Guide for Development Teams

This guide walks developers through setting up the AI Commit Validator in their projects with all the latest features including the new auto-open error locations capability.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Integration](#integration)
5. [Advanced Features](#advanced-features)
6. [Team Setup](#team-setup)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Quick Start

Get the validator running in 5 minutes:

```bash
# 1. Install globally or locally
npm install ai-commit-validator

# 2. Create .env file
cat > .env << EOF
GITHUB_TOKEN=your_token_here
AI_AUTO_OPEN_ERRORS=true
EOF

# 3. Setup git hook
npx husky install
npx husky add .husky/pre-commit "npx validate-commit"

# 4. Make a commit
git add .
git commit -m "SHOP-1234: Your commit message"

# 5. Watch the validator work!
```

---

## Installation

### Option 1: Local Project Installation (Recommended)

```bash
# Install as a dev dependency
npm install --save-dev ai-commit-validator

# Verify installation
npx validate-commit --help
```

### Option 2: Global Installation

```bash
# Install globally
npm install -g ai-commit-validator

# Use anywhere
validate-commit
```

### Option 3: Using Husky (Git Hooks)

```bash
# Initialize Husky
npm install husky --save-dev
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "npx validate-commit"

# Test the hook
git commit -m "test"
```

---

## Configuration

### Step 1: Create Environment File

Create `.env.local` or `.env` in your project root:

```bash
# GitHub Token for enhanced features
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx

# Auto-open error locations (new in v2.2.0!)
AI_AUTO_OPEN_ERRORS=true

# Default behavior on prompt timeout
AI_DEFAULT_ON_CANCEL=cancel

# Prompt timeout in milliseconds
AI_PROMPT_TIMEOUT_MS=30000

# Force prompts in non-TTY environments
AI_FORCE_PROMPT=false

# Production mode (suppresses debug logs)
NODE_ENV=development
```

### Step 2: Get GitHub Token

For enhanced analysis features:

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:user`
4. Copy the token to `.env`

```bash
# Example
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnop
```

### Step 3: Configure for Your Team

Create `.env.team` for shared team configuration:

```bash
# Team settings
AI_DEFAULT_ON_CANCEL=auto-apply
AI_PROMPT_TIMEOUT_MS=60000
NODE_ENV=development

# Team-specific rules (optional)
TEAM_NAME=backend-team
ENFORCE_CODE_REVIEW=true
```

---

## Integration

### With Husky (Git Hooks)

```bash
# 1. Install Husky
npm install husky --save-dev

# 2. Initialize
npx husky install

# 3. Create pre-commit hook
npx husky add .husky/pre-commit "npx validate-commit"

# 4. Test
git add .
git commit -m "Test message"
```

### With GitHub Actions (CI/CD)

```yaml
# .github/workflows/validate-commits.yml
name: Validate Commits

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm install -D ai-commit-validator
      
      - name: Validate all commits
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_ENV: production
          AI_AUTO_SELECT: 5  # Skip validation
        run: npx validate-commit
```

### With Pre-commit Framework

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: ai-commit-validator
        name: AI Commit Validator
        entry: npx validate-commit
        language: system
        stages: [commit]
```

### Manual Integration

Add to `package.json` scripts:

```json
{
  "scripts": {
    "validate-commit": "validate-commit",
    "prepare": "husky install",
    "postinstall": "husky install || true"
  }
}
```

---

## Advanced Features

### 1. Auto-Open Error Locations (v2.2.0)

Enable automatic file opening at error locations:

```bash
# Enable in .env
AI_AUTO_OPEN_ERRORS=true

# Or set inline
AI_AUTO_OPEN_ERRORS=true git commit -m "message"
```

**Supports:**
- VS Code (primary)
- Sublime Text
- Vim
- Manual fallback

### 2. Non-Interactive Mode

For CI/CD pipelines without TTY:

```bash
# Auto-select option 1 (first choice)
export AI_AUTO_SELECT=1

# Auto-confirm
export AI_AUTO_SELECT=true

# In CI
NODE_ENV=production AI_AUTO_SELECT=5 npm run validate-commit
```

### 3. Custom Timeout

Set prompt timeout in milliseconds:

```bash
# Wait indefinitely for prompts
export AI_PROMPT_TIMEOUT_MS=0

# 60 second timeout
export AI_PROMPT_TIMEOUT_MS=60000

# Quick 5 second timeout
export AI_PROMPT_TIMEOUT_MS=5000
```

### 4. Force Prompts

Enable prompts in non-TTY environments:

```bash
# Force prompts even in hooks
export AI_FORCE_PROMPT=true

# Use with caution - may hang in CI/CD
```

### 5. Default Behavior on Timeout

Configure what happens when prompts timeout:

```bash
# Cancel commit (safest - default)
export AI_DEFAULT_ON_CANCEL=cancel

# Skip validation
export AI_DEFAULT_ON_CANCEL=skip

# Auto-apply suggestions
export AI_DEFAULT_ON_CANCEL=auto-apply
```

---

## Team Setup

### For Development Teams

Create a shared `.env.team` template:

```bash
# .env.team
GITHUB_TOKEN=team_token_here

# All developers auto-open errors
AI_AUTO_OPEN_ERRORS=true

# Timeout after 45 seconds
AI_PROMPT_TIMEOUT_MS=45000

# Debug mode for development
NODE_ENV=development
```

Instructions for team members:

```bash
# 1. Copy team template
cp .env.team .env.local

# 2. Update personal token (if needed)
echo "GITHUB_TOKEN=your_personal_token" >> .env.local

# 3. Start committing with AI review!
git commit -m "SHOP-1234: Feature description"
```

### For Corporate Environments

Create `.env.corp` with strict settings:

```bash
# Corporate settings
AI_AUTO_OPEN_ERRORS=true
AI_DEFAULT_ON_CANCEL=cancel
AI_PROMPT_TIMEOUT_MS=30000

# Enforce code quality
ENFORCE_SECURITY_CHECK=true
ENFORCE_PERFORMANCE_CHECK=true

# Logging for audit
ENABLE_AUDIT_LOG=true
NODE_ENV=production
```

### For CI/CD Pipelines

Create `.env.ci` for automation:

```bash
# CI/CD settings
NODE_ENV=production

# Non-interactive mode
AI_AUTO_SELECT=5  # Skip validation automatically

# Suppress debug output
DEBUG=false

# Short timeouts
AI_PROMPT_TIMEOUT_MS=5000
```

---

## Troubleshooting

### Issue: "GITHUB_TOKEN not found"

```bash
# Solution 1: Create .env file
echo "GITHUB_TOKEN=your_token" > .env

# Solution 2: Export as environment variable
export GITHUB_TOKEN=your_token

# Verify
echo $GITHUB_TOKEN
```

### Issue: "Files not opening in editor"

```bash
# Verify VS Code is installed
code --version

# If not found, install or add to PATH
# macOS: `brew install --cask visual-studio-code`
# Windows: Download from https://code.visualstudio.com

# Manually test opening files
code "index.js:42"
```

### Issue: "Prompt times out or is cancelled"

```bash
# Solution 1: Increase timeout
export AI_PROMPT_TIMEOUT_MS=60000

# Solution 2: Set default behavior
export AI_DEFAULT_ON_CANCEL=skip

# Solution 3: Use non-interactive mode
export AI_AUTO_SELECT=1
```

### Issue: "No staged changes found"

```bash
# Solution: Stage files first
git add .

# Verify staged files
git diff --cached --name-only
```

### Issue: "Hook fails in GitHub Actions"

```yaml
# Use non-interactive mode in CI
- name: Validate
  env:
    NODE_ENV: production
    AI_AUTO_SELECT: 5
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npx validate-commit
```

### Enable Debug Logging

```bash
# Set development mode
export NODE_ENV=development

# Run commit with full output
git commit -m "test" 2>&1 | tee commit.log

# Check logs
cat commit.log | grep "🔍\|💡\|⚠️"
```

---

## Best Practices

### ✅ Do's

1. **Use `.env.local` for secrets**
   ```bash
   # .env.local (git ignored)
   GITHUB_TOKEN=your_secret_token
   
   # .env (committed)
   AI_AUTO_OPEN_ERRORS=true
   ```

2. **Enable auto-open for better DX**
   ```bash
   # Dramatically improves developer experience
   AI_AUTO_OPEN_ERRORS=true
   ```

3. **Use realistic timeouts**
   ```bash
   # Give developers time to read and respond
   AI_PROMPT_TIMEOUT_MS=45000
   ```

4. **Document team settings**
   ```bash
   # Create SETUP.md for new developers
   echo "1. Run 'cp .env.team .env.local'" >> SETUP.md
   ```

5. **Test the hook locally first**
   ```bash
   # Before pushing to team
   git add .
   git commit -m "test" --no-verify  # Skip on first test
   ```

### ❌ Don'ts

1. **Don't commit `.env` with secrets**
   ```bash
   # Make sure .env is in .gitignore
   echo ".env" >> .gitignore
   echo ".env.local" >> .gitignore
   ```

2. **Don't use `AI_FORCE_PROMPT` in CI/CD**
   ```bash
   # Can hang pipelines - use AI_AUTO_SELECT instead
   # ❌ Bad
   AI_FORCE_PROMPT=true npx validate-commit
   
   # ✅ Good
   AI_AUTO_SELECT=5 npx validate-commit
   ```

3. **Don't disable validation completely**
   ```bash
   # Keep at least basic validation
   # ❌ Bad
   NODE_ENV=production git commit --no-verify
   
   # ✅ Good
   AI_AUTO_SELECT=1 git commit -m "message"
   ```

4. **Don't use very short timeouts**
   ```bash
   # Developers need time to read feedback
   # ❌ Bad
   AI_PROMPT_TIMEOUT_MS=3000
   
   # ✅ Good
   AI_PROMPT_TIMEOUT_MS=30000
   ```

5. **Don't commit personal tokens**
   ```bash
   # Use team tokens or GitHub Actions secrets
   # ❌ Bad
   GITHUB_TOKEN=ghp_personal_token  # in .env
   
   # ✅ Good
   GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}  # in Actions
   ```

### 📋 Pre-Commit Checklist

Before deploying validator to team:

- [ ] Test locally on Windows, macOS, and Linux
- [ ] Verify editor opening works (VS Code, Sublime)
- [ ] Test in non-interactive environment (CI/CD)
- [ ] Document setup steps in SETUP.md
- [ ] Create template `.env.team`
- [ ] Test with real commits
- [ ] Get team feedback
- [ ] Document in project wiki

---

## Quick Reference

### Common Commands

```bash
# Test validator
git add .
git commit -m "test"

# Test with auto-open
AI_AUTO_OPEN_ERRORS=true git commit -m "test"

# Test in non-interactive mode
AI_AUTO_SELECT=1 git commit -m "test"

# Bypass validator
git commit --no-verify -m "emergency hotfix"

# Check configuration
cat .env
echo $AI_AUTO_OPEN_ERRORS
```

### Environment Variable Cheat Sheet

| Use Case | Configuration |
|----------|---|
| **Local Development** | `AI_AUTO_OPEN_ERRORS=true` |
| **Team Development** | Copy `.env.team`, add personal token |
| **CI/CD Pipeline** | `NODE_ENV=production AI_AUTO_SELECT=5` |
| **Code Review** | `AI_AUTO_OPEN_ERRORS=true AI_DEFAULT_ON_CANCEL=cancel` |
| **Quick Fix** | `git commit --no-verify -m "hotfix"` |

---

## Getting Help

### Documentation Files

- **[README.md](./README.md)** - Main documentation
- **[FEATURES_2.2.0.md](./FEATURES_2.2.0.md)** - New features in v2.2.0
- **[AUTO_OPEN_ERRORS.md](./AUTO_OPEN_ERRORS.md)** - Detailed auto-open guide
- **[ENV_CONFIG_GUIDE.md](./ENV_CONFIG_GUIDE.md)** - Environment variable reference

### Useful Commands

```bash
# View all available options
npx validate-commit --help

# Enable verbose output
NODE_ENV=development git commit -m "test"

# Check installed version
npm list ai-commit-validator

# Update to latest
npm install ai-commit-validator@latest
```

### Support

- Check documentation files above
- Enable debug logging: `NODE_ENV=development`
- Review `.env` configuration
- Test with simple commits first

---

## Version History

| Version | Release | Key Features |
|---------|---------|---|
| **2.2.0** | Nov 2024 | Auto-open error locations, editor detection |
| **2.1.19** | Nov 2024 | Proper commit rejection, improved stability |
| **2.0.0** | Oct 2024 | Interactive workflow, auto-apply fixes |

---

## Feedback

Have questions or suggestions? We'd love to hear from you!

- **Found a bug?** Enable debug logging and check logs
- **Want a feature?** Document your use case
- **Setup questions?** Refer to this guide and the documentation files

---

**Happy coding! 🚀**
