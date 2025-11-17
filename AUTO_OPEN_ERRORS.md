# Auto-Open Error Locations Feature

## Overview

Starting with version 2.2.0, the AI Commit Validator now supports automatically opening files at specific error locations with intelligent editor detection and inline fix suggestions.

When code issues are detected, the validator can:
- **Automatically open the offending file** in your preferred editor (VS Code, Sublime Text, Vim, etc.)
- **Navigate to the exact line number** where the issue occurs
- **Display the suggested fix** in the terminal for quick reference
- **Support multiple error locations** with interactive browsing

## How It Works

### Architecture

1. **Error Detection**: Copilot analysis identifies issues with file:line format
2. **Pattern Matching**: Extracts file paths and line numbers from analysis
3. **Editor Detection**: Automatically finds VS Code, Sublime Text, or Vim
4. **File Opening**: Launches editor at the exact error location
5. **Fix Display**: Shows suggestions alongside file opening

### Supported Editors

- **Visual Studio Code** (Primary - recommended)
- **Sublime Text** (Secondary fallback)
- **Vim** (Linux/macOS fallback)
- **Manual opening** (Fallback if no editor found)

## Configuration

### Enable Auto-Open Errors

Set the environment variable to enable this feature:

```bash
export AI_AUTO_OPEN_ERRORS=true
```

Or in your `.env` or `.env.local` file:

```env
AI_AUTO_OPEN_ERRORS=true
```

### Default Behavior (Disabled)

By default, auto-opening is disabled to avoid unexpected behavior. You must explicitly enable it:

```bash
# Before committing
export AI_AUTO_OPEN_ERRORS=true

# Or use inline
AI_AUTO_OPEN_ERRORS=true git commit -m "message"
```

## Usage Examples

### Example 1: Basic Usage with VS Code

```bash
# Enable the feature
export AI_AUTO_OPEN_ERRORS=true

# Commit your code
git commit -m "SHOP-1234: Fix user authentication"

# If errors are found, VS Code automatically opens at error location
# Terminal shows:
# ✅ Validator detected issues
# 📂 Opening index.js:42 in VS Code...
# 💡 Suggestion: Use descriptive variable names (e.g., userData, isLoading)
```

### Example 2: Non-Interactive Environment (CI/CD)

Errors are reported but files are not opened:

```bash
# In CI/CD pipeline - auto-open disabled by default
git commit -m "Build: Update dependencies"

# Output shows error locations:
# ❌ Commit rejected: Code issues found
# 🟢 index.js:7 - Non-descriptive variable name
# 🟢 index.js:7 - All-caps non-constant variable
```

### Example 3: Multiple Error Locations

```bash
# When multiple errors are found:
# 📂 Opening 3 error location(s)...
# 📂 Opening index.js:42 in VS Code...
#
# ⚠️  Found 2 more error(s):
#   2. utils.js:15 - Missing error handling
#   3. config.js:28 - Hardcoded credentials
#
# ? Open additional error locations? (y/N)
```

## Error Location Format

The validator detects errors in this format within the analysis:

```
filename.js:line_number - Issue description
```

### Examples of Detected Errors

```
index.js:7 - Non-descriptive variable name
utils.js:15 - Missing error handling
config.js:28 - Hardcoded credentials
```

## Workflow Integration

### Step 1: Create Issues in Code

```javascript
// index.js
const jahbscjhbaj = "data"; // ❌ Non-descriptive name
let FALGEEKAJSCH = false;    // ❌ Misleading caps
```

### Step 2: Stage Changes

```bash
git add index.js
```

### Step 3: Commit with Auto-Open Enabled

```bash
export AI_AUTO_OPEN_ERRORS=true
git commit -m "SHOP-1234: Update user module"
```

### Step 4: Validator Opens File at Error Line

```
🎯 Enhanced AI Workflow Activated!
📂 Opening 2 error location(s)...
📂 Opening index.js:1 in VS Code...

💡 Suggestions:
   1. Use descriptive variable names that explain purpose
   2. Reserve CONSTANT_CASE for true constants only

❌ Commit rejected: Code issues found
🔍 Issues detected - fix them and commit again
```

## Advanced Configuration

### Combined with Other Features

```bash
# Auto-open errors + auto-select response + non-interactive mode
export AI_AUTO_OPEN_ERRORS=true
export AI_AUTO_SELECT=1
export AI_DEFAULT_ON_CANCEL=cancel
export AI_PROMPT_TIMEOUT_MS=5000

git commit -m "SHOP-1234: Update code"
```

### VS Code Specific Settings

If VS Code isn't opening properly, ensure:

1. VS Code is installed and in PATH:
   ```bash
   code --version
   ```

2. The workspace folder is accessible:
   ```bash
   pwd  # Verify you're in the git repository
   ```

3. Try forcing VS Code:
   ```bash
   export AI_AUTO_OPEN_ERRORS=true
   code "index.js:42"  # Manual test
   ```

## Troubleshooting

### Issue: Files Not Opening

**Check editor availability:**
```bash
code --version      # VS Code
subl --version      # Sublime Text
which vim           # Vim (Linux/macOS)
```

**Solution:** Install your preferred editor or add to PATH.

### Issue: Wrong Line Number

**Ensure staged changes match analysis:**
```bash
git diff --cached --name-only  # View staged files
git diff --cached               # Review exact changes
```

**Solution:** Re-stage files if line numbers have shifted.

### Issue: Feature Not Activating

**Verify environment variable:**
```bash
echo $AI_AUTO_OPEN_ERRORS  # Should print: true

# Or set it inline:
AI_AUTO_OPEN_ERRORS=true git commit -m "test"
```

### Issue: Timeout When Editor Opens

**The validator waits for editor to be ready:**
- Use lightweight editors (VS Code is faster than Sublime)
- Or disable auto-open in low-bandwidth environments

**Solution:** Wait for editor to fully launch before responding.

## Performance Notes

- **First editor open**: 1-3 seconds (initial app launch)
- **Subsequent opens**: <500ms (editor already running)
- **No impact if disabled**: Feature has zero overhead when `AI_AUTO_OPEN_ERRORS=false`

## Security Considerations

- Files are opened read-write (you can edit immediately)
- No files are modified without your approval
- Suggestions are displayed, not auto-applied
- Works only within your local repository

## Disabling Auto-Open

To disable this feature at any time:

```bash
# Unset the environment variable
unset AI_AUTO_OPEN_ERRORS

# Or explicitly set to false
export AI_AUTO_OPEN_ERRORS=false
```

## Future Enhancements

Planned features for future versions:

- [ ] Custom editor support (configure preferred editor)
- [ ] Multi-file diffing in editor
- [ ] Inline code suggestions with VS Code snippets
- [ ] Syntax highlighting for suggested fixes
- [ ] Integration with VS Code Problems panel
- [ ] Browser-based editor support

## FAQs

**Q: Does this work with remote repositories?**  
A: Yes, auto-open works locally. For remote repositories, files are opened from your local clone.

**Q: Can I auto-apply fixes while editor is open?**  
A: Not simultaneously. The validator waits for confirmation before applying changes.

**Q: What happens on Windows PowerShell?**  
A: Full support. VS Code, Sublime, and WSL editors all work seamlessly.

**Q: Is there performance overhead?**  
A: Minimal. Editor detection and opening happens asynchronously and can be disabled entirely.

## Feedback & Issues

Have suggestions or encountered bugs?

- Report issues on GitHub
- Enable verbose logging: `NODE_ENV=development`
- Include your editor version and OS in reports
