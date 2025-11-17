# AI Commit Validator 🤖 *(Optional - Nice to Have)*

An **optional** AI-powered commit validator that acts as your intelligent code reviewer before commits. Uses GitHub Copilot and intelligent local analysis to analyze your staged changes and provide actionable feedback. **Designed to be non-blocking** - if AI validation fails, commits still proceed with appropriate warnings.

## ✨ Features

- 🤖 **GitHub Copilot Integration**: Uses GitHub Copilot API for world-class code analysis
- 🔍 **Optional Pre-commit Validation**: Reviews staged changes without blocking commits *(NEW in v2.5.0)*
- 🎨 **Interactive CLI**: Beautiful colored output with PowerShell compatibility
- 📂 **Auto-Open Errors**: Automatically opens files at error locations with cross-platform support
- 🔧 **Side-by-Side Comparison**: Visual code comparison showing original vs suggested improvements
- 🚀 **Graceful Fallback**: Continues with local analysis if AI services are unavailable
- 📊 **Smart Skip Directives**: Production-ready skip validation with `[skip-ai]` comments
- 💡 **Non-Blocking Design**: Always allows commits to proceed, even if AI validation fails

## 🚀 Installation

### Global Installation
```bash
npm install -g ai-commit-validator
```

### Local Installation
```bash
npm install ai-commit-validator
```

## ⚙️ Configuration

### 1. OpenAI API Key Setup

Create a `.env` file in your project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**Getting your OpenAI API Key:**
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new secret key
5. Copy and paste it into your `.env` file

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GITHUB_TOKEN` | 🔧 Optional | GitHub Personal Access Token for Copilot API | - |
| `AI_OPTIONAL_MODE` | 💡 Recommended | Make AI validation optional (nice to have) | `true` |
| `AI_AUTO_OPEN_ERRORS` | ❌ No | Auto-open files at error locations | `false` |
| `AI_DEFAULT_ON_CANCEL` | ❌ No | Default action on prompt timeout | `auto-apply` |
| `AI_PROMPT_TIMEOUT_MS` | ❌ No | Timeout for interactive prompts (ms) | `30000` |
| `AI_AUTO_SELECT` | ❌ No | Auto-respond in non-interactive mode | - |
| `AI_FORCE_PROMPT` | ❌ No | Force prompts in non-TTY environments | `false` |

### 🎯 Optional Mode (Recommended)

Set `AI_OPTIONAL_MODE=true` in your `.env` file to make AI validation optional:

```dotenv
# Make AI validation non-blocking (nice to have)
AI_OPTIONAL_MODE=true
GITHUB_TOKEN=ghp_your_github_token_here
```

**Benefits of Optional Mode:**
- ✅ **Never blocks commits** - Always allows commits to proceed
- 🤖 **Best effort AI review** - Provides suggestions when available
- 🌐 **Network resilient** - Works offline or with connectivity issues  
- ⚡ **Fast commits** - No waiting for AI when services are unavailable
- 🔧 **Manual fallback** - Shows clear guidance when AI review fails

## 🎯 Usage

### Command Line Interface

```bash
# Validate staged changes
validate-commit
```

### Git Hook Integration

#### Option 1: Pre-commit Hook (Recommended)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Run AI commit validator
npx validate-commit
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

#### Option 2: Manual Validation

```bash
# Stage your changes
git add .

# Run validation
validate-commit

# If validation passes, commit
git commit -m "Your commit message"
```

### Programmatic Usage

```javascript
import { validateCommit } from 'ai-commit-validator';

// Run validation
await validateCommit();
```

## 🔄 Workflow

1. **Stage Changes**: Add files to git staging area
   ```bash
   git add .
   ```

2. **AI Analysis**: The validator automatically:
   - Analyzes your staged changes
   - Sends the diff to OpenAI for review
   - Receives intelligent feedback

3. **Interactive Decision**: Based on AI feedback, you can:
   - ✅ **Apply suggestions** - Make recommended changes
   - ⚠️ **Skip with justification** - Bypass with required reason
   - ❌ **Cancel commit** - Stop the commit process

4. **Commit**: If validation passes or is bypassed, proceed with commit

## 📝 Example Output

```bash
🔍 Checking your staged changes...
🧠 Sending code diff to AI for review...

🤖 AI Review Feedback:

I found a few areas for improvement:

1. **Security Issue**: The API key is hardcoded in line 15. Consider using environment variables.
2. **Performance**: The loop in `processData()` could be optimized using `map()` instead of `forEach()`.
3. **Error Handling**: Missing try-catch block around the database query on line 23.

What do you want to do?
❯ Apply suggestions and continue
  Skip validation with comment
  Cancel commit
```

## 🎨 Features in Detail

### AI-Powered Analysis
- **Code Quality**: Identifies potential bugs, security issues, and performance problems
- **Best Practices**: Suggests improvements following coding standards
- **Documentation**: Recommends better comments and documentation
- **Refactoring**: Suggests cleaner, more maintainable code patterns

### Interactive Experience
- **Colored Output**: Beautiful terminal interface with chalk.js
- **Progress Indicators**: Clear feedback during AI processing
- **Smart Prompts**: Contextual questions based on analysis results

### Bypass Protection
- **Justification Required**: Must provide reason when skipping suggestions
- **Audit Trail**: Logs bypass reasons for team accountability
- **Configurable**: Can be customized for team requirements

## 🛠️ Advanced Configuration

### Custom AI Model
Modify the model in `index.js`:
```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4", // Change to your preferred model
  messages: [{ role: "user", content: prompt }],
});
```

### Custom Prompts
Customize the AI prompt for your team's needs:
```javascript
const prompt = `
You are a senior code reviewer for our team.
Focus on: security, performance, and maintainability.
Use our team's coding standards: [link to standards]
...
`;
```

## 🔧 Troubleshooting

### Common Issues

**Error: No OpenAI API Key**
```bash
Error: OpenAI API key not found
```
**Solution**: Ensure `.env` file exists with `OPENAI_API_KEY=your_key`

**Error: No staged changes**
```bash
⚠️ No staged changes found
```
**Solution**: Stage files first with `git add .`

**Error: API Rate Limit**
```bash
Error: Rate limit exceeded
```
**Solution**: Wait a moment and try again, or upgrade your OpenAI plan

### Debug Mode

Add debug logging by modifying `index.js`:
```javascript
console.log('Debug: Staged diff:', diff);
console.log('Debug: AI Response:', aiFeedback);
```

## 📊 Performance

- **Average Analysis Time**: 2-5 seconds
- **API Cost**: ~$0.001-0.01 per commit (depending on change size)
- **Supported File Types**: All text-based files (JS, TS, Python, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Stage your changes: `git add .`
4. Run the validator: `validate-commit`
5. Commit your changes: `git commit -m "Add amazing feature"`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a pull request

## 📋 Requirements

- **Node.js**: >= 16.0.0
- **Git**: Any recent version
- **OpenAI API Key**: Required for AI analysis
- **Internet Connection**: Required for API calls

## 🆕 v2.2.0 - Auto-Open Error Locations

The validator now automatically opens files at error locations with intelligent editor detection!

**Features:**
- 📂 Opens files directly in VS Code, Sublime Text, or Vim
- 🎯 Navigates to the exact error line
- 💡 Shows fix suggestions in the terminal
- ✅ Fully optional (disabled by default)

**Quick Start:**
```bash
export AI_AUTO_OPEN_ERRORS=true
git commit -m "Your commit message"
# Files with errors open automatically in your editor!
```

**Documentation:** See [FEATURES_2.2.0.md](./FEATURES_2.2.0.md) and [AUTO_OPEN_ERRORS.md](./AUTO_OPEN_ERRORS.md) for detailed information.

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Sanjib Roy**

## 🙏 Acknowledgments

- OpenAI for providing the GPT API
- The open-source community for the excellent libraries used
- GitHub Copilot for inspiration

## 🔗 Related Projects

- [branch-commit-validator](https://www.npmjs.com/package/branch-commit-validator) - Traditional pattern-based validation
- [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) - Commit message conventions

## 📈 Roadmap

- [ ] Support for multiple AI providers (Claude, Gemini)
- [ ] Team-specific rule customization
- [ ] Integration with popular IDEs
- [ ] Batch analysis for multiple commits
- [ ] Custom rule engine
- [ ] Performance metrics and analytics

---

**Made with ❤️ by [Sanjib Roy](https://github.com/snbroyvfc95)**

*Transform your commit process with AI-powered code review!* 🚀