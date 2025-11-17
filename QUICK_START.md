# Quick Start Guide - Auto-Open Error Locations

## 5-Minute Setup

### Step 1: Enable the Feature (30 seconds)

```bash
# Add to your .env.local file
echo "AI_AUTO_OPEN_ERRORS=true" >> .env.local

# Or set as environment variable
export AI_AUTO_OPEN_ERRORS=true
```

### Step 2: Make a Test Commit (1 minute)

```bash
# Create a file with intentional issues
echo "const jahbscjhbaj = 'test';" > test.js

# Stage it
git add test.js

# Commit
git commit -m "SHOP-1234: Test feature"
```

### Step 3: Watch It Work! (3 minutes)

```
✨ Validator Analysis Running...

🟢 test.js:1 - Non-descriptive variable name

💡 Suggestion: Use descriptive variable names
💡 Example: userData, isLoading, config

📂 Opening test.js:1 in VS Code...

(VS Code automatically opens at the error line!)
```

---

## Common Workflows

### Workflow 1: Development

```bash
# 1. Enable once
export AI_AUTO_OPEN_ERRORS=true

# 2. Make changes and commit normally
git add .
git commit -m "SHOP-1234: Feature"

# 3. If errors found, editor opens automatically
# 4. Fix the issues
# 5. Save and commit again

✅ Done!
```

### Workflow 2: Code Review

```bash
# 1. Enable for reviewing team member's code
AI_AUTO_OPEN_ERRORS=true git merge feature-branch

# 2. Editor opens at issues automatically
# 3. Review and discuss with team
# 4. Make improvements

✅ Better code quality!
```

### Workflow 3: CI/CD (Keep Disabled)

```bash
# In GitHub Actions - auto-open not needed
env:
  NODE_ENV: production
  AI_AUTO_SELECT: 5  # Skip validation

# File opening is skipped automatically
# Pipeline runs smoothly

✅ No interruptions!
```

---

## Troubleshooting

### "VS Code not opening?"

```bash
# 1. Check if VS Code is installed
code --version

# 2. If missing, install from:
# https://code.visualstudio.com

# 3. Add to PATH if needed
export PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"  # macOS
# or
export PATH="C:\Program Files\Microsoft VS Code\bin:$PATH"  # Windows
```

### "Wrong editor opening?"

```bash
# Sublime Text will open instead of VS Code if VS Code not in PATH
# Check priority order:
# 1. VS Code
# 2. Sublime Text
# 3. Vim
# 4. Manual fallback

# Solution: Install preferred editor
```

### "Not working at all?"

```bash
# 1. Verify environment variable is set
echo $AI_AUTO_OPEN_ERRORS  # Should print: true

# 2. Check file has errors
git diff --cached

# 3. Enable debug mode
NODE_ENV=development git commit -m "test"

# 4. Look for:
# "💡 Set AI_AUTO_OPEN_ERRORS=true..."  (means disabled)
# "📂 Opening file..."                   (means working)
```

---

## Configuration Cheat Sheet

| Need | Environment Variable | Value |
|------|---|---|
| Enable auto-open | `AI_AUTO_OPEN_ERRORS` | `true` |
| Disable auto-open | `AI_AUTO_OPEN_ERRORS` | `false` |
| Longer timeout | `AI_PROMPT_TIMEOUT_MS` | `60000` |
| Shorter timeout | `AI_PROMPT_TIMEOUT_MS` | `5000` |
| Skip on timeout | `AI_DEFAULT_ON_CANCEL` | `skip` |
| Auto-apply on timeout | `AI_DEFAULT_ON_CANCEL` | `auto-apply` |
| Non-interactive mode | `AI_AUTO_SELECT` | `1` (or choice #) |
| Debug mode | `NODE_ENV` | `development` |

---

## Real-World Examples

### Example 1: Fixing Variable Names

```bash
# Your code has bad variable names
const jahbscjhbaj = "userData";
let FALGEEKAJSCH = false;

# Commit with auto-open enabled
$ AI_AUTO_OPEN_ERRORS=true git commit -m "SHOP-1234: Update user module"

# Output:
# 🟢 index.js:7 - Non-descriptive variable name
# 📂 Opening index.js:7 in VS Code...

# VS Code opens at line 7!
# You can immediately see the issue and fix it:

const userData = "userData";           # ✅ Clear name
let isFormValid = false;               # ✅ Descriptive
```

### Example 2: Security Issues

```bash
# Hardcoded password
const password = "admin123";

$ git commit -m "SHOP-5678: Login module"

# Output:
# 🔴 config.js:42 - Hardcoded credentials detected
# 📂 Opening config.js:42 in VS Code...

# Fix immediately:
const password = process.env.DB_PASSWORD;  # ✅ From env var
```

### Example 3: Team Code Review

```bash
# Reviewing pull request
$ git checkout feature/new-feature
$ git pull origin feature/new-feature

$ AI_AUTO_OPEN_ERRORS=true git merge main

# Output:
# 🟠 api.js:15 - Missing error handling
# 📂 Opening api.js:15 in VS Code...

# As reviewer, you can immediately see the issue!
# Much faster code review process
```

---

## Tips & Tricks

### ✅ Pro Tips

1. **Keep it enabled during development**
   ```bash
   echo "AI_AUTO_OPEN_ERRORS=true" >> .env.local
   ```

2. **Use with VS Code for best experience**
   - Fastest file opening
   - Best editor integration
   - Smooth experience

3. **Combine with other features**
   ```bash
   export AI_AUTO_OPEN_ERRORS=true
   export AI_DEFAULT_ON_CANCEL=cancel
   export AI_PROMPT_TIMEOUT_MS=60000
   ```

4. **Disable only when needed**
   ```bash
   AI_AUTO_OPEN_ERRORS=false git commit -m "quick fix"
   ```

5. **Use in team setup**
   ```bash
   # Add to .env.team for consistency
   # Create setup guide for new developers
   ```

### 🔧 Technical Tips

1. **File detection works for**
   - .js, .ts, .jsx, .tsx (JavaScript/TypeScript)
   - .py (Python)
   - .java (Java)
   - .rb (Ruby)
   - .go (Go)
   - .rs (Rust)

2. **Error format recognized**
   ```
   filename.js:42 - Error description
   utils.ts:15 - Another error
   config.py:28 - Third error
   ```

3. **Multiple errors supported**
   - First error opens automatically
   - Additional errors offered interactively
   - User can browse through them

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| **Detect errors** | ~1s | Analysis happens anyway |
| **Extract error locations** | ~100ms | Regex pattern matching |
| **Find editor** | ~500ms | Cached after first run |
| **Open editor** | 1-3s | VS Code startup time |
| **Total overhead** | 2-4s | Only when feature enabled |

**Bottom line**: Adding 2-4 seconds to your commit is worth the faster error fixing!

---

## Frequently Asked Questions

### Q: Will this slow down my commits?

A: Only by 2-4 seconds (editor opening time), and only if you enable it. Disabled by default.

### Q: Does this work in CI/CD pipelines?

A: Yes! The feature automatically skips file opening in non-interactive environments.

### Q: Can I use a different editor?

A: Currently supports VS Code, Sublime Text, and Vim. Can be extended for others.

### Q: What if I don't want to open files?

A: It's optional! Just don't set `AI_AUTO_OPEN_ERRORS=true`. Default is disabled.

### Q: Does this work on Windows PowerShell?

A: Yes! Full support for Windows, macOS, and Linux.

### Q: Can I automate this?

A: Yes! Use `AI_AUTO_SELECT` in CI/CD environments for non-interactive mode.

---

## Next Steps

1. ✅ **Enable the feature**: `export AI_AUTO_OPEN_ERRORS=true`
2. ✅ **Try it out**: Make a test commit with intentional issues
3. ✅ **See it work**: Watch files open automatically
4. ✅ **Get the full guide**: Read `AUTO_OPEN_ERRORS.md`
5. ✅ **Share with team**: Use `DEVELOPER_SETUP_GUIDE.md`

---

## Get Help

| Need | Resource |
|------|----------|
| **Quick reference** | This file (QUICK_START.md) |
| **Full feature guide** | `AUTO_OPEN_ERRORS.md` |
| **Setup guide** | `DEVELOPER_SETUP_GUIDE.md` |
| **Release info** | `RELEASE_NOTES_2.2.0.md` |
| **Technical details** | `IMPLEMENTATION_SUMMARY.md` |

---

## Support

For issues or questions:

1. Check this quick start guide
2. Enable debug mode: `NODE_ENV=development`
3. Review the comprehensive guides above
4. Check the main `README.md`

---

**Happy coding! Let the validator guide you to world-class code.** 🚀

Version: 2.2.0 | Feature: Auto-Open Error Locations | Status: ✅ Ready
