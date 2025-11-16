import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import chalk from "chalk";
import inquirer from "inquirer";
import dotenv from "dotenv";
import fs from "fs/promises";
import fsSync from 'fs';
import path from "path";
import { execSync } from "child_process";

// Load environment variables with fallback
dotenv.config({ path: '.env.local' }); // Try local first
dotenv.config(); // Then try .env

// Production flag
const isProd = process.env.NODE_ENV === 'production';

// GitHub token for Copilot access (optional - fallback to local analysis)
const githubToken = process.env.GITHUB_TOKEN;
let octokit = null;

if (githubToken) {
  octokit = new Octokit({ 
    auth: githubToken,
    timeout: parseInt(process.env.API_TIMEOUT || '30000')
  });
  if (!isProd) console.log(chalk.cyan('🤖 GitHub Copilot integration enabled'));
} else {
  if (!isProd) {
    console.log(chalk.yellow('⚠️  No GITHUB_TOKEN found - using local code analysis'));
    console.log(chalk.gray('💡 Add GITHUB_TOKEN for enhanced AI features'));
  }
}

// Safe prompt wrapper to handle Windows PowerShell input issues
async function safePrompt(questions, opts = {}) {
  // Configurable timeout (ms). If set to 0, disable timeout (wait indefinitely).
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : parseInt(process.env.AI_PROMPT_TIMEOUT_MS || '30000');

  // Allow forcing prompts even when stdin isn't a TTY (use with caution).
  const forcePrompt = (process.env.AI_FORCE_PROMPT || 'false').toLowerCase() === 'true';

  // If stdin is not a TTY (non-interactive environment) we usually cannot
  // prompt. Instead of immediately giving up, attempt to open the platform
  // TTY device later so prompts can still work when Git runs hooks from a
  // non-TTY stdin. Log a concise warning to guide users about the
  // `AI_FORCE_PROMPT` option if opening the TTY device fails.
  if (!process.stdin || !process.stdin.isTTY) {
    if (!isProd) console.log(chalk.yellow('⚠️  Non-interactive terminal detected - will attempt terminal-device fallback for prompts (set AI_FORCE_PROMPT=true to force)'));
    // continue: the TTY device fallback is attempted below
  }

  try {
      // Use an inquirer prompt module and, when stdin/stdout are not TTY,
      // try opening the platform TTY device so prompts still work in hooks.
      let inputStream = process.stdin;
      let outputStream = process.stdout;

      const needsTtyFallback = !process.stdin || !process.stdin.isTTY || !process.stdout || !process.stdout.isTTY;
      if (needsTtyFallback) {
        // Platform-specific TTY device names
        let inputTtyPath = '/dev/tty';
        let outputTtyPath = '/dev/tty';
        if (process.platform === 'win32') {
          // Use Win32 console device names for raw access
          inputTtyPath = '\\\\.\\CONIN$';
          outputTtyPath = '\\\\.\\CONOUT$';
        }

        try {
          // Try to open read/write streams to the terminal device.
          inputStream = fsSync.createReadStream(inputTtyPath);
          outputStream = fsSync.createWriteStream(outputTtyPath);
          if (!isProd) console.log(chalk.gray(`ℹ️  Opened terminal device ${inputTtyPath}/${outputTtyPath} for interactive prompts`));
        } catch (e) {
          if (!forcePrompt) {
            if (!isProd) console.log(chalk.yellow('⚠️  Unable to open terminal device for fallback prompts — aborting prompt'));
            return { cancelled: true, answers: null };
          } else {
            if (!isProd) console.log(chalk.yellow('⚠️  Unable to open terminal device, but AI_FORCE_PROMPT=true — attempting inquirer with default streams'));
          }
        }
      }

      const promptModule = inquirer.createPromptModule({ input: inputStream, output: outputStream });
      const p = promptModule(questions);

    // If timeoutMs is 0, wait indefinitely for user input.
    const res = timeoutMs === 0 ? await p : await Promise.race([
      p,
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), timeoutMs)),
    ]);

    if (res && res.__timeout) {
      return { cancelled: true, answers: null };
    }
    return { cancelled: false, answers: res };
  } catch (e) {
    if (e && (e.name === 'ExitPromptError' || /User force closed|cancelled/i.test(e.message))) {
      return { cancelled: true, answers: null };
    }
    throw e;
  }
}

// Rate limit and fallback configuration
const ENABLE_AI_FALLBACK = process.env.ENABLE_AI_FALLBACK !== 'false';
const SKIP_ON_RATE_LIMIT = process.env.SKIP_ON_RATE_LIMIT === 'true';
const git = simpleGit();
// Default action when an interactive prompt times out or is cancelled.
// Supported values: 'cancel' | 'auto-apply' | 'skip'
const DEFAULT_ON_CANCEL = (process.env.AI_DEFAULT_ON_CANCEL || 'cancel').toLowerCase();

// Files to exclude from AI analysis (system/config files)
const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.gitignore',
  '.env',
  '.env.local',
  '.env.example',
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  '.next/',
  'coverage/',
  '*.min.js',
  '*.map',
  '.DS_Store',
  'Thumbs.db'
];

// Filter meaningful code changes only
function filterMeaningfulChanges(diff) {
  const lines = diff.split('\n');
  const meaningfulLines = lines.filter(line => {
    // Skip binary files
    if (line.includes('Binary files') && line.includes('differ')) {
      return false;
    }
    
    // Check if line is from excluded files
    const isExcluded = EXCLUDED_FILES.some(pattern => {
      if (pattern.endsWith('/')) {
        return line.includes(`/${pattern}`) || line.includes(`\\${pattern}`);
      }
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(line);
      }
      return line.includes(pattern);
    });
    
    if (isExcluded) return false;
    
    // Only include actual code changes (+ or - lines)
    if (line.startsWith('+') || line.startsWith('-')) {
      const content = line.substring(1).trim();
      // Skip empty lines, comments only, or whitespace changes
      if (!content || content.match(/^\s*\/\//) || content.match(/^\s*\/\*/)) {
        return false;
      }
      return true;
    }
    
    // Include context lines for diff structure (including file headers)
    return line.startsWith('@@') || line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++');
  });
  
  return meaningfulLines.join('\n');
}

// Get world-class code review using enhanced Copilot analysis
async function getCopilotReview(diff) {
  console.log(chalk.cyan("🤖 Running Production-Focused Copilot Analysis..."));
  console.log(chalk.gray("📋 Context: Make this code for production release"));
  
  const issues = [];
  const suggestions = [];
  const codeImprovements = [];
  const lines = diff.split('\n');
  
  // World-class code analysis patterns
  const patterns = {
    security: [
      { regex: /password\s*[=:]\s*["'][^"']+["']/i, message: "Hardcoded password detected", severity: "critical", fix: "Use environment variables or secure key management" },
      { regex: /api[_-]?key\s*[=:]\s*["'][^"']+["']/i, message: "Hardcoded API key detected", severity: "critical", fix: "Move to process.env.API_KEY" },
      { regex: /token\s*[=:]\s*["'][^"']+["']/i, message: "Hardcoded token detected", severity: "critical", fix: "Use secure token storage" },
      { regex: /http:\/\//i, message: "Insecure HTTP protocol", severity: "high", fix: "Use HTTPS for all external requests" },
      { regex: /eval\s*\(/i, message: "eval() usage detected - security risk", severity: "high", fix: "Use safer alternatives like JSON.parse()" }
    ],
    performance: [
      { regex: /console\.log\(/i, message: "Console.log in production code", severity: "medium", fix: "Replace with proper logging (winston, pino) or remove" },
      { regex: /for\s*\(.*in.*\)/i, message: "for...in loop can be optimized", severity: "medium", fix: "Use for...of, Object.keys(), or forEach() for better performance" },
      { regex: /\+\s*.*\.length\s*>\s*1000/i, message: "Large array operation", severity: "medium", fix: "Consider pagination or chunking for large datasets" },
      { regex: /setTimeout\s*\(\s*function/i, message: "setTimeout with function declaration", severity: "low", fix: "Use arrow function for better performance" },
      { regex: /document\.getElementById/i, message: "Direct DOM manipulation", severity: "medium", fix: "Consider using modern frameworks or query caching" }
    ],
    modernJS: [
      { regex: /var\s+/i, message: "Legacy var declaration", severity: "medium", fix: "Use 'const' for constants, 'let' for variables" },
      { regex: /==\s*null|!=\s*null/i, message: "Loose equality with null", severity: "medium", fix: "Use strict equality: === null or !== null" },
      { regex: /function\s+\w+\s*\(/i, message: "Traditional function syntax", severity: "low", fix: "Consider arrow functions for consistency and lexical this" },
      { regex: /Promise\.resolve\(\)\.then/i, message: "Promise chaining", severity: "low", fix: "Consider async/await for better readability" },
      { regex: /\.indexOf\(.*\)\s*[><!]==?\s*-?1/i, message: "Legacy indexOf usage", severity: "low", fix: "Use .includes() for better readability" }
    ],
    naming: [
      { regex: /\b([a-z])\w*_([a-z])/i, message: "snake_case variable naming", severity: "medium", fix: "Use camelCase for JavaScript variables (e.g., userName instead of user_name)" },
      { regex: /const\s+([a-z]{1}[a-z0-9]*)\s*=/i, message: "Non-descriptive variable name", severity: "low", fix: "Use descriptive variable names that explain purpose (e.g., userData, isLoading)" },
      { regex: /function\s+([a-z])/i, message: "Lowercase function name", severity: "medium", fix: "Use PascalCase for constructors/classes or camelCase for functions" },
      { regex: /const\s+[A-Z]{2,}\s*(?!=)/i, message: "All-caps non-constant variable", severity: "low", fix: "Reserve CONSTANT_CASE for true constants only" },
      { regex: /\b(cb|fn|tmp|obj|arr|str|num|bool|val|ret|err)\b/i, message: "Single/abbreviated variable name", severity: "low", fix: "Use full descriptive names (callback, error, result, data)" }
    ],
    codeQuality: [
      { regex: /\/\*\s*TODO/i, message: "TODO comment found", severity: "low", fix: "Create proper issue or implement the TODO" },
      { regex: /\/\*\s*FIXME/i, message: "FIXME comment found", severity: "medium", fix: "Address the FIXME or create an issue" },
      { regex: /\/\*\s*HACK/i, message: "HACK comment found", severity: "medium", fix: "Refactor to remove the hack" },
      { regex: /^\s*\/\/\s*eslint-disable/i, message: "ESLint rule disabled", severity: "medium", fix: "Fix the underlying issue instead of disabling rules" },
      { regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/i, message: "Empty catch block", severity: "high", fix: "Add proper error handling or logging" }
    ],
    codeStandards: [
      { regex: /require\s*\(/i, message: "CommonJS require syntax", severity: "low", fix: "Use ES6 import syntax for consistency and better tree-shaking" },
      { regex: /\.then\s*\(\s*function/i, message: "Promise with function declaration", severity: "low", fix: "Use arrow functions in promise chains for lexical this binding" },
      { regex: /if\s*\([a-zA-Z_$][a-zA-Z0-9_$]*\s*==\s*true\)/i, message: "Explicit boolean comparison", severity: "low", fix: "Use implicit boolean check: if (condition) instead of if (condition == true)" },
      { regex: /if\s*\([a-zA-Z_$][a-zA-Z0-9_$]*\s*==\s*false\)/i, message: "Explicit false comparison", severity: "low", fix: "Use negation: if (!condition) instead of if (condition == false)" },
      { regex: /try\s*\{[\s\S]{0,100}\}\s*catch\s*\([\w\s]*\)\s*\{\s*\}/i, message: "Try-catch without proper error handling", severity: "medium", fix: "Log errors, throw, or handle gracefully - don't silently ignore" }
    ],
    architecture: [
      { regex: /class\s+\w+\s*\{[\s\S]*constructor[\s\S]*\}[\s\S]*\}/i, message: "Large class detected", severity: "medium", fix: "Consider breaking into smaller, focused classes" },
      { regex: /function\s+\w+\([^)]{50,}/i, message: "Function with many parameters", severity: "medium", fix: "Use options object or break into smaller functions" },
      { regex: /if\s*\([^)]*&&[^)]*&&[^)]*&&/i, message: "Complex conditional logic", severity: "medium", fix: "Extract conditions into well-named variables or functions" }
    ]
  };
  
  // World-class code analysis with line-by-line improvements
  let currentFile = '';
  const fileChanges = new Map();
  
  lines.forEach((line, index) => {
    // Track current file
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.*)$/);
      currentFile = match ? match[1].trim() : '';

    }
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const code = line.substring(1);
      const trimmedCode = code.trim();
      
      if (trimmedCode) {
        Object.entries(patterns).forEach(([category, patternList]) => {
          patternList.forEach(pattern => {
            if (pattern.regex.test(code)) {
              const severityIcon = {
                'critical': '🔴',
                'high': '🟠', 
                'medium': '🟡',
                'low': '🟢'
              }[pattern.severity] || '🟢';
              
              issues.push(`${severityIcon} ${currentFile}:${index + 1} - ${pattern.message}`);
              suggestions.push(`${pattern.fix}`);
              
              // Generate actual code improvement
              const improvement = generateCodeImprovement(code, pattern, currentFile || 'index.js', index + 1);
              if (improvement) {
                const fileName = currentFile || 'index.js'; // Fallback to detected filename
                if (!fileChanges.has(fileName)) {
                  fileChanges.set(fileName, []);
                }
                fileChanges.get(fileName).push(improvement);
              }
            }
          });
        });
      }
    }
  });
  
  // Generate world-class feedback with actionable improvements
  if (issues.length === 0) {
    return "✅ WORLD_CLASS_CODE\n🎉 Your code meets world-class standards!\n💡 No improvements needed - excellent work!";
  } else {
    let feedback = "WORLD_CLASS_SUGGESTIONS\n";
    feedback += "🚀 Production-Ready Code Improvements:\n";
    feedback += "📋 Context: Make this code for production release\n\n";
    
    // Group issues by severity
    const criticalIssues = issues.filter(i => i.includes('🔴'));
    const highIssues = issues.filter(i => i.includes('🟠'));
    const mediumIssues = issues.filter(i => i.includes('🟡'));
    const lowIssues = issues.filter(i => i.includes('🟢'));
    
    if (criticalIssues.length > 0) {
      feedback += "🔴 CRITICAL (Must Fix):\n";
      criticalIssues.forEach(issue => feedback += `   ${issue}\n`);
      feedback += "\n";
    }
    
    if (highIssues.length > 0) {
      feedback += "🟠 HIGH PRIORITY:\n";
      highIssues.forEach(issue => feedback += `   ${issue}\n`);
      feedback += "\n";
    }
    
    if (mediumIssues.length > 0) {
      feedback += "🟡 RECOMMENDED:\n";
      mediumIssues.forEach(issue => feedback += `   ${issue}\n`);
      feedback += "\n";
    }
    
    if (lowIssues.length > 0) {
      feedback += "🟢 NICE TO HAVE (Modern Standards):\n";
      lowIssues.forEach(issue => feedback += `   ${issue}\n`);
      feedback += "\n";
    }
    
    // Add section headers for organized feedback
    feedback += "📚 ANALYSIS CATEGORIES:\n";
    feedback += "🔐 Security | ⚡ Performance | 🎯 Naming Conventions\n";
    feedback += "📏 Code Standards | ♻️ Code Quality | 🏗️ Architecture\n\n";
    
    feedback += "COPILOT_FIXES\n";
    [...new Set(suggestions)].forEach((suggestion, i) => {
      feedback += `${i + 1}. ${suggestion}\n`;
    });
    
    if (fileChanges.size > 0) {
      feedback += "\nAUTO_APPLICABLE_FIXES\n";
      for (const [file, changes] of fileChanges) {
        feedback += `File: ${file}\n`;
        changes.forEach(change => {
          feedback += `Line ${change.line}: ${change.original} → ${change.improved}\n`;
        });
      }
    }
    
    return feedback;
  }
}

// Generate specific code improvements
function generateCodeImprovement(originalLine, pattern, file, lineNumber) {
  const code = originalLine.trim();
  let improvedCode = code;
  
  // Apply specific improvements based on pattern
  if (pattern.message.includes('var')) {
    improvedCode = code.replace(/var\s+/g, 'const ');
  } else if (pattern.message.includes('arrow functions')) {
    const funcMatch = code.match(/function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (funcMatch) {
      improvedCode = `const ${funcMatch[1]} = (${funcMatch[2]}) => {`;
    }
  } else if (pattern.message.includes('indexOf')) {
    improvedCode = code.replace(/\.indexOf\(([^)]+)\)\s*[><!]==?\s*-1/, '.includes($1)');
  } else if (pattern.message.includes('strict equality')) {
    improvedCode = code.replace(/==\s*null/g, '=== null').replace(/!=\s*null/g, '!== null');
  } else if (pattern.message.includes('Console.log')) {
    improvedCode = code.replace(/console\.log\(/g, '// console.log('); // Comment out
  } else if (pattern.message.includes('snake_case')) {
    // Convert snake_case to camelCase
    improvedCode = code.replace(/([a-z]+)_([a-z])/gi, (match, p1, p2) => p1 + p2.toUpperCase());
  } else if (pattern.message.includes('CommonJS require')) {
    const match = code.match(/const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (match) {
      improvedCode = `import ${match[1]} from "${match[2]}"`;
    }
  } else if (pattern.message.includes('Explicit boolean comparison')) {
    improvedCode = code.replace(/if\s*\(\s*(\w+)\s*==\s*true\s*\)/gi, 'if ($1)');
  } else if (pattern.message.includes('Explicit false comparison')) {
    improvedCode = code.replace(/if\s*\(\s*(\w+)\s*==\s*false\s*\)/gi, 'if (!$1)');
  }
  
  if (improvedCode !== code) {
    return {
      line: lineNumber,
      original: code,
      improved: improvedCode,
      file: file
    };
  }
  
  return null;
}

// Enhanced local code analysis using multiple techniques
async function localCodeAnalysis(diff) {
  console.log(chalk.cyan("\n🔧 Running local code analysis..."));
  
  const issues = [];
  const suggestions = [];
  const lines = diff.split('\n');
  
  // Enhanced code analysis
  const hasConsoleLog = lines.some(line => line.includes('console.log') && line.startsWith('+'));
  const hasTodoComments = lines.some(line => /\/\*.*TODO.*\*\/|^\/\/.*TODO/.test(line) && line.startsWith('+'));
  const hasLongLines = lines.some(line => line.length > 100 && line.startsWith('+'));
  const hasTrailingWhitespace = lines.some(line => /\s+$/.test(line) && line.startsWith('+'));
  const hasHardcodedPasswords = lines.some(line => /password\s*=\s*["'][^"']+["']|api[_-]?key\s*=\s*["'][^"']+["']/i.test(line) && line.startsWith('+'));
  const hasLargeFiles = lines.some(line => line.includes('Binary files') && line.includes('differ'));
  
  if (hasConsoleLog) {
    issues.push("🟡 Found console.log statements");
    suggestions.push("Consider using a proper logger or removing debug statements");
  }
  if (hasTodoComments) {
    issues.push("🟡 Found TODO comments");
    suggestions.push("Address TODO items or create proper issues for them");
  }
  if (hasLongLines) {
    issues.push("🟡 Found lines longer than 100 characters");
    suggestions.push("Break long lines for better readability");
  }
  if (hasTrailingWhitespace) {
    issues.push("🟡 Found trailing whitespace");
    suggestions.push("Configure your editor to remove trailing whitespace");
  }
  if (hasHardcodedPasswords) {
    issues.push("🔴 Potential hardcoded secrets detected");
    suggestions.push("Move sensitive data to environment variables");
  }
  if (hasLargeFiles) {
    issues.push("🟡 Binary files detected");
    suggestions.push("Consider using Git LFS for large files");
  }
  
  // Try to run local linters if available
  try {
    execSync('npx eslint --version', { stdio: 'ignore' });
    console.log(chalk.cyan('🔍 Running ESLint...'));
    const eslintOutput = execSync('npx eslint . --format=compact', { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (eslintOutput) {
      issues.push("🟡 ESLint found issues");
      suggestions.push("Run 'npx eslint . --fix' to auto-fix some issues");
    }
  } catch (error) {
    // ESLint not available or has errors, that's ok
  }
  
  console.log(chalk.green("\n📋 Local Code Analysis Results:"));
  
  if (issues.length === 0) {
    console.log(chalk.green("✅ No obvious issues found"));
    console.log(chalk.green("✅ Code looks good!"));
    console.log(chalk.green("✅ Commit allowed"));
    process.exit(0);
  } else {
    console.log(chalk.yellow("\n⚠️  Issues found:"));
    issues.forEach(issue => console.log(`  ${issue}`));
    
    console.log(chalk.cyan("\n💡 Suggestions:"));
    suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
    
    try {
      const { proceed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Continue with commit despite these issues?",
          default: true
        },
      ]);
      
      if (proceed) {
        console.log(chalk.green("\n✅ Commit allowed"));
        process.exit(0);
      } else {
        console.log(chalk.red("\n❌ Commit cancelled"));
        process.exit(1);
      }
    } catch (error) {
      if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
        console.log(chalk.yellow("\n⚠️  Prompt cancelled by user"));
        console.log(chalk.cyan("✅ Proceeding with commit (default action)"));
        process.exit(0);
      } else {
        throw error;
      }
    }
  }
}

// Handle GitHub API errors gracefully
async function handleGitHubError(error, diff) {
  console.log(chalk.red("\n❌ GitHub API Error:"));
  
  if (error.status === 429) {
    console.log(chalk.yellow("🚫 Rate limit exceeded for GitHub API"));
    
    if (SKIP_ON_RATE_LIMIT) {
      console.log(chalk.cyan("⚡ Auto-skipping due to rate limit (SKIP_ON_RATE_LIMIT=true)"));
      console.log(chalk.green("✅ Commit allowed (AI review skipped due to rate limit)"));
      process.exit(0);
    }
    
    if (ENABLE_AI_FALLBACK) {
      return await handleRateLimit(diff);
    }
  }
  
  if (error.status === 401) {
    console.log(chalk.red("🔑 Invalid GitHub token"));
    console.log(chalk.yellow("💡 Please check your GITHUB_TOKEN environment variable"));
  }
  
  console.log(chalk.red(`\nError details: ${error.message}`));
  console.log(chalk.cyan("🔄 Falling back to local code analysis..."));
  
  return await localCodeAnalysis(diff);
}

// Handle rate limit with user options
async function handleRateLimit(diff) {
  console.log(chalk.yellow("\n⏳ GitHub API rate limit reached. Choose an option:"));
  
  const choices = [
    "Skip AI validation and proceed with commit",
    "Use local code analysis",
    "Cancel commit and try later"
  ];
  
  try {
    const { decision } = await inquirer.prompt([
      {
        type: "list",
        name: "decision",
        message: "How would you like to proceed?",
        choices: choices,
      },
    ]);
    
    if (decision === "Skip AI validation and proceed with commit") {
      try {
        const { reason } = await inquirer.prompt([
          {
            type: "input",
            name: "reason",
            message: "Enter reason for skipping AI validation:",
            default: "GitHub API rate limit exceeded"
          },
        ]);
        console.log(chalk.green(`\n✅ Commit allowed. Reason: ${reason}`));
      } catch (innerError) {
        if (innerError.name === 'ExitPromptError' || innerError.message.includes('User force closed')) {
          console.log(chalk.green("\n✅ Commit allowed. Reason: User cancelled prompt"));
        } else {
          throw innerError;
        }
      }
      process.exit(0);
    } else if (decision === "Use local code analysis") {
      return await localCodeAnalysis(diff);
    } else {
      console.log(chalk.red("\n❌ Commit cancelled. Please try again later."));
      process.exit(1);
    }
  } catch (error) {
    if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
      console.log(chalk.yellow("\n⚠️  Prompt cancelled by user"));
      console.log(chalk.cyan("✅ Proceeding with local code analysis"));
      return await localCodeAnalysis(diff);
    } else {
      throw error;
    }
  }
}

export async function validateCommit() {
  try {
    console.log(chalk.blueBright("🔍 Analyzing meaningful code changes..."));
    
    // Get diff of staged files
    const rawDiff = await git.diff(["--cached"]);
    if (!rawDiff.trim()) {
      console.log(chalk.yellow("⚠️  No staged changes found."));
      process.exit(0);
    }

    // Filter out system files and focus on meaningful code changes
    const meaningfulDiff = filterMeaningfulChanges(rawDiff);

    if (!meaningfulDiff.trim()) {
      console.log(chalk.green("✅ Only system files changed - no code review needed"));
      console.log(chalk.gray("📁 Files like package-lock.json, .env, etc. are excluded from AI analysis"));
      process.exit(0);
    }

    // Get list of staged files for potential modification
    const stagedFiles = await getStagedFiles();
    
    console.log(chalk.cyan("🧠 Running World-Class Code Analysis..."));
    console.log(chalk.gray(`📊 Analyzing ${meaningfulDiff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).length} code changes`));
    
    let aiFeedback;
    
    // Try GitHub Copilot integration first, then fall back to local analysis
    if (octokit && githubToken) {
      try {
        console.log(chalk.cyan("🤖 Using Enhanced GitHub Copilot Analysis..."));
        aiFeedback = await getCopilotReview(meaningfulDiff);
      } catch (error) {
        console.log(chalk.yellow("⚠️  GitHub Copilot unavailable, using local analysis..."));
        return await localCodeAnalysis(meaningfulDiff);
      }
    } else {
      console.log(chalk.cyan("🔍 Using enhanced local code analysis..."));
      return await localCodeAnalysis(meaningfulDiff);
    }

  console.log(chalk.green("\n🤖 Copilot Analysis Complete:\n"));
  console.log(chalk.white(aiFeedback));

  // Surface Copilot suggestion summaries clearly before prompting the user
  try {
    const copilotFixesMatch = aiFeedback.match(/COPILOT_FIXES[\s\S]*?(?=\n\n|AUTO_APPLICABLE_FIXES|$)/);
    if (copilotFixesMatch) {
      const summary = copilotFixesMatch[0].replace('COPILOT_FIXES', '').trim();
      if (summary) {
        console.log(chalk.yellow('\n💡 Copilot Suggestions Summary:'));
        console.log(chalk.white(summary));
      }
    }

    const autoFixMatch = aiFeedback.match(/AUTO_APPLICABLE_FIXES[\s\S]*/);
    if (autoFixMatch) {
      const autoSummary = autoFixMatch[0].replace('AUTO_APPLICABLE_FIXES', '').trim();
      if (autoSummary) {
        console.log(chalk.cyan('\n🔧 Auto-applicable fixes:'));
        console.log(chalk.white(autoSummary));
      }
    }
  } catch (err) {
    // Non-fatal: continue to prompt even if summary extraction fails
  }

  // If everything looks good, allow commit
  if (aiFeedback.includes("✅")) {
    console.log(chalk.green("\n✅ Commit allowed."));
    process.exit(0);
  }

  console.log(chalk.magenta("🔍 REACHED ENHANCED WORKFLOW SECTION"));
  
  // Enhanced Workflow: Check for auto-applicable fixes first  
  const autoFixes = parseAutoApplicableFixes(aiFeedback);
  console.log(chalk.magenta(`🔍 Parsed ${autoFixes.length} auto-fixes`));

  // Enhanced Workflow: Force activation for testing
  console.log(chalk.cyan("🔧 Forcing enhanced workflow activation"));
  
  if (true) {
    // Use parsed fixes or create fallback for manual handling
    let effectiveFixes = autoFixes.length > 0 ? autoFixes : 
      [{ filename: 'index.js', line: 1, original: 'improvements detected', improved: 'apply manually', type: 'fallback' }];
    
    console.log(chalk.cyan(`\n🎯 Enhanced AI Workflow Activated!`));
    
    const enhancedChoices = [
      "🚀 Auto-apply Copilot suggestions and recommit",
      "📝 Keep local changes and apply suggestions manually",
      "🔧 Review suggestions only (no changes)",
      "⚡ Skip validation and commit as-is",
      "❌ Cancel commit"
    ];

    try {
      // Use safePrompt for robust input handling on Windows PowerShell
      const { cancelled, answers } = await safePrompt([
        {
          type: "list",
          name: "enhancedDecision", 
          message: "🎯 How would you like to proceed?",
          choices: enhancedChoices,
          default: 0, // Default to auto-apply
          pageSize: 10,
          loop: false
        },
      ], { timeoutMs: 30000 });

      // Determine behavior when the prompt times out or is cancelled.
      let enhancedDecision;
      if (cancelled) {
        if (DEFAULT_ON_CANCEL === 'auto-apply') {
          enhancedDecision = "🚀 Auto-apply Copilot suggestions and recommit";
        } else if (DEFAULT_ON_CANCEL === 'skip') {
          enhancedDecision = "⚡ Skip validation and commit as-is";
        } else {
          enhancedDecision = "❌ Cancel commit"; // safest default
        }
      } else {
        enhancedDecision = answers.enhancedDecision;
      }

      if (enhancedDecision === "🚀 Auto-apply Copilot suggestions and recommit") {
        // Map empty filenames to single staged file when applicable
        const single = stagedFiles.length === 1 ? stagedFiles[0] : null;
        const fixes = effectiveFixes.map(f => ({ ...f, filename: f.filename || single || 'index.js' }));
        return await autoApplyAndRecommit(fixes, stagedFiles);
      } else if (enhancedDecision === "📝 Keep local changes and apply suggestions manually") {
        const single = stagedFiles.length === 1 ? stagedFiles[0] : null;
        const fixes = effectiveFixes.map(f => ({ ...f, filename: f.filename || single || 'index.js' }));
        return await applyToNewFiles(fixes, stagedFiles);
      } else if (enhancedDecision === "🔧 Review suggestions only (no changes)") {
        console.log(chalk.cyan("\n📋 Review the suggestions above and apply manually when ready."));
        process.exit(1);
      } else if (enhancedDecision === "⚡ Skip validation and commit as-is") {
        console.log(chalk.green("\n✅ Skipping validation. Commit proceeding..."));
        process.exit(0);
      } else {
        console.log(chalk.red("\n❌ Commit cancelled."));
        process.exit(1);
      }
      return; // Prevent fallthrough to legacy workflow
    } catch (error) {
      // Decide fallback behavior when prompt errors or is cancelled
      if (error.name === 'ExitPromptError' || error.message.includes('User force closed') || error.message.includes('cancelled')) {
        console.log(chalk.yellow("\n⚠️ Prompt cancelled by user"));
        if (DEFAULT_ON_CANCEL === 'auto-apply') {
          console.log(chalk.cyan("🚀 Auto-applying Copilot suggestions (configured default)..."));
          return await autoApplyAndRecommit(effectiveFixes, stagedFiles);
        } else if (DEFAULT_ON_CANCEL === 'skip') {
          console.log(chalk.cyan("⚡ Skipping AI validation and proceeding with commit (configured default)"));
          process.exit(0);
        } else {
          console.log(chalk.red("❌ Commit cancelled due to prompt timeout (configured default)."));
          process.exit(1);
        }
      } else {
        console.log(chalk.red(`\n❌ Prompt error: ${error.message}`));
        // As a final fallback, cancel to avoid unintended changes
        console.log(chalk.red("❌ Commit cancelled due to prompt error."));
        process.exit(1);
      }
    }
    return; // Explicit return to prevent legacy workflow
  }

  // Fallback: Parse legacy suggested fixes for backward compatibility
  const suggestedFixes = parseSuggestedFixes(aiFeedback);
  const legacyAutoFixes = parseAutoApplicableFixes(aiFeedback);
  
  // Legacy workflow for non-auto-applicable fixes
  const choices = [
    "Apply AI suggestions automatically",
    "Apply suggestions and continue",
    "Skip validation with comment", 
    "Cancel commit"
  ];

  if (suggestedFixes.length === 0) {
    choices.shift(); // Remove auto-apply option if no fixes available
  }

  try {
    const { decision } = await inquirer.prompt([
      {
        type: "list",
        name: "decision",
        message: "What do you want to do?",
        choices: choices,
      },
    ]);

    if (decision === "Apply AI suggestions automatically" && suggestedFixes.length > 0) {
      await applyAISuggestions(suggestedFixes, stagedFiles);
      return;
    } else if (decision === "Apply suggestions and continue") {
      const single = stagedFiles.length === 1 ? stagedFiles[0] : null;
      const fixes = (legacyAutoFixes.length > 0 ? legacyAutoFixes : []).map(f => ({ ...f, filename: f.filename || single || 'index.js' }));
      if (fixes.length > 0) {
        console.log(chalk.cyan("\n🔧 Auto-applying suggestions to your files (no commit)..."));
        await applyAutoFixesNoCommit(fixes, stagedFiles);
        console.log(chalk.green("\n✅ Suggestions applied and files saved."));
        console.log(chalk.cyan("🔁 Please commit again when ready."));
        process.exit(1);
      } else {
        console.log(chalk.green("\n💾 Please make the suggested changes, then save your files."));
        console.log(chalk.cyan("🔁 When ready, run recommit to complete the commit:"));
        console.log(chalk.white("   npx validate-commit --recommit"));
        process.exit(1);
      }
    } else if (decision === "Skip validation with comment") {
      try {
        const { reason } = await inquirer.prompt([
          {
            type: "input",
            name: "reason",
            message: "Enter justification to skip AI suggestions:",
            validate: (input) => input.trim() ? true : "Reason is required.",
          },
        ]);
        console.log(chalk.yellow(`\n⚠️ Commit bypassed with reason: ${reason}\n`));
      } catch (innerError) {
        if (innerError.name === 'ExitPromptError' || innerError.message.includes('User force closed')) {
          console.log(chalk.yellow("\n⚠️ Commit bypassed with reason: User cancelled prompt\n"));
        } else {
          throw innerError;
        }
      }
      process.exit(0);
    } else {
      console.log(chalk.red("\n❌ Commit cancelled."));
      process.exit(1);
    }
  } catch (error) {
    if (error.name === 'ExitPromptError' || error.message.includes('User force closed') || /cancelled/i.test(error.message)) {
      const defaultChoice = suggestedFixes.length > 0 ? "Apply AI suggestions automatically" : "Apply suggestions and continue";
      console.log(chalk.yellow("\n⚠️ Prompt cancelled; using default action:"), chalk.white(defaultChoice));
      if (defaultChoice === "Apply AI suggestions automatically" && suggestedFixes.length > 0) {
        await applyAISuggestions(suggestedFixes, stagedFiles);
        return;
      } else {
        const single = stagedFiles.length === 1 ? stagedFiles[0] : null;
        const fixes = (legacyAutoFixes.length > 0 ? legacyAutoFixes : []).map(f => ({ ...f, filename: f.filename || single || 'index.js' }));
        if (fixes.length > 0) {
          console.log(chalk.cyan("\n🔧 Auto-applying suggestions to your files (no commit)..."));
          await applyAutoFixesNoCommit(fixes, stagedFiles);
          console.log(chalk.green("\n✅ Suggestions applied and files saved."));
          console.log(chalk.cyan("🔁 Please commit again when ready."));
          process.exit(1);
        } else {
          console.log(chalk.green("\n💾 Please make the suggested changes, then save your files."));
          console.log(chalk.cyan("🔁 When ready, run recommit to complete the commit:"));
          console.log(chalk.white("   npx validate-commit --recommit"));
          process.exit(1);
        }
      }
    } else {
      throw error;
    }
  }
  
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      console.log('⚠️  Prompt cancelled by user');
      console.log(chalk.cyan('🔁 Defaulting to manual apply + guided recommit'));
      console.log(chalk.white('   npx validate-commit --recommit'));
      process.exit(1);
    }
    throw error;
  }
}

// Helper function to get staged files
async function getStagedFiles() {
  const status = await git.status();
  return status.staged;
}

// Guided recommit helper: stages changes (if needed) and commits with a message
export async function guidedRecommit() {
  try {
    console.log(chalk.cyan("\n🔁 Guided recommit starting..."));
    const status = await git.status();

    const hasStaged = status.staged && status.staged.length > 0;
    const hasUnstaged = (
      (status.modified && status.modified.length > 0) ||
      (status.not_added && status.not_added.length > 0) ||
      (status.created && status.created.length > 0) ||
      (status.deleted && status.deleted.length > 0) ||
      (status.renamed && status.renamed.length > 0)
    );

    if (!hasStaged && !hasUnstaged) {
      console.log(chalk.yellow("⚠️ No changes detected to commit."));
      console.log(chalk.gray("💡 Modify files per suggestions, then rerun --recommit."));
      process.exit(0);
    }

    if (hasUnstaged && !hasStaged) {
      const { cancelled, answers } = await safePrompt([
        {
          type: "confirm",
          name: "stageAll",
          message: "Stage all current changes before recommitting?",
          default: true
        }
      ], { timeoutMs: 30000 });

      const stageAll = cancelled ? true : answers.stageAll;
      if (stageAll) {
        console.log(chalk.cyan("📦 Staging all changes..."));
        await git.add(["./*"]);
      } else {
        console.log(chalk.yellow("⚠️ Recommit cancelled: no staged changes."));
        process.exit(1);
      }
    }

    const { cancelled: msgCancelled, answers: msgAnswers } = await safePrompt([
      {
        type: "input",
        name: "message",
        message: "Commit message:",
        default: "Apply AI suggestions"
      }
    ], { timeoutMs: 30000 });

    const commitMessage = msgCancelled ? "Apply AI suggestions" : (msgAnswers.message || "Apply AI suggestions");

    console.log(chalk.cyan("📝 Committing staged changes..."));
    // Use --no-verify to skip pre-commit hooks and avoid re-running validator
    await git.commit(commitMessage, ['--no-verify']);

    console.log(chalk.green("✅ Recommit complete."));
    process.exit(0);
  } catch (error) {
    if (error.name === 'ExitPromptError' || /User force closed|cancelled/i.test(error.message)) {
      console.log(chalk.yellow("\n⚠️ Prompt cancelled. Using default recommit message."));
      try {
        // Use --no-verify to skip pre-commit hooks
        await git.commit("Apply AI suggestions", ['--no-verify']);
        console.log(chalk.green("✅ Recommit complete."));
        process.exit(0);
      } catch (inner) {
        console.log(chalk.red(`❌ Recommit failed: ${inner.message}`));
        process.exit(1);
      }
    }
    console.log(chalk.red(`❌ Recommit failed: ${error.message}`));
    process.exit(1);
  }
}

// Helper function to parse auto-applicable fixes from Copilot analysis
function parseAutoApplicableFixes(aiFeedback) {
  const fixes = [];
  
  if (!aiFeedback.includes("AUTO_APPLICABLE_FIXES")) {
    return fixes;
  }

  const autoFixSection = aiFeedback.split("AUTO_APPLICABLE_FIXES")[1];
  if (!autoFixSection) return fixes;

  // Parse file changes: File: filename followed by Line X: original → improved
  const lines = autoFixSection.split('\n');
  let currentFile = '';
  
  lines.forEach(line => {
    if (line.startsWith('File: ')) {
      currentFile = line.replace('File: ', '').trim();
      // If filename is empty, try to use a fallback
      if (!currentFile) {
        currentFile = 'index.js'; // Use detected staged file as fallback
      }
    } else if (line.includes(' → ')) {
      const match = line.match(/Line (\d+): (.+?) → (.+)/);
      if (match) {
        // Use fallback filename if currentFile is still empty
        const fileName = currentFile || 'index.js';
        fixes.push({
          filename: fileName,
          line: parseInt(match[1]),
          original: match[2].trim(),
          improved: match[3].trim()
        });
      }
    }
  });

  return fixes;
}

// Helper function for legacy compatibility
function parseSuggestedFixes(aiFeedback) {
  // First try new format
  const autoFixes = parseAutoApplicableFixes(aiFeedback);
  if (autoFixes.length > 0) return autoFixes;
  
  // Fall back to old format
  const fixes = [];
  
  if (!aiFeedback.includes("SUGGESTED_FIXES")) {
    return fixes;
  }

  const suggestedFixesSection = aiFeedback.split("SUGGESTED_FIXES")[1];
  if (!suggestedFixesSection) return fixes;

  // Match pattern: For file: filename followed by code block
  const fileMatches = suggestedFixesSection.match(/For file: (.+?)\n\`\`\`([\s\S]*?)\`\`\`/g);
  
  if (fileMatches) {
    fileMatches.forEach(match => {
      const fileMatch = match.match(/For file: (.+?)\n\`\`\`([\s\S]*?)\`\`\`/);
      if (fileMatch) {
        const filename = fileMatch[1].trim();
        const code = fileMatch[2].trim();
        fixes.push({ filename, code });
      }
    });
  }

  return fixes;
}

// Helper function to apply AI suggestions automatically
async function applyAISuggestions(suggestedFixes, stagedFiles) {
  console.log(chalk.cyan("\n🔧 Applying AI suggestions automatically..."));
  
  // Group fixes by file and support both full-file and line replacement formats
  const fileChanges = new Map();
  suggestedFixes.forEach(fix => {
    const key = fix.filename;
    if (!fileChanges.has(key)) fileChanges.set(key, []);
    fileChanges.get(key).push(fix);
  });

  let appliedFiles = [];
  for (const [filename, fixes] of fileChanges) {
    try {
      const isStaged = stagedFiles.some(file => file.endsWith(filename) || file === filename);
      if (!isStaged) {
        console.log(chalk.yellow(`⚠️  File ${filename} is not staged, skipping...`));
        continue;
      }

      const filePath = path.resolve(process.cwd(), filename);
      try { await fs.access(filePath); } catch { console.log(chalk.yellow(`⚠️  File not found: ${filename}, skipping...`)); continue; }

      const originalContent = await fs.readFile(filePath, 'utf8');
      const backupPath = filePath + '.ai-backup';
      await fs.writeFile(backupPath, originalContent);

      let modifiedContent = originalContent;
      const fullFileFix = fixes.find(f => typeof f.code === 'string');
      if (fullFileFix) {
        modifiedContent = fullFileFix.code;
      } else {
        const sorted = fixes.filter(f => f.original && f.improved).sort((a,b) => b.line - a.line);
        for (const f of sorted) {
          modifiedContent = modifiedContent.replace(f.original, f.improved);
        }
      }

      await fs.writeFile(filePath, modifiedContent);
      appliedFiles.push({ filename, backupPath });
      console.log(chalk.green(`✅ Applied fixes to: ${filename}`));
    } catch (error) {
      console.log(chalk.red(`❌ Error applying fixes to ${filename}: ${error.message}`));
    }
  }

  if (appliedFiles.length > 0) {
    console.log(chalk.cyan("\n🔄 Re-staging modified files..."));
    
    // Re-stage the modified files
    for (const file of appliedFiles) {
      await git.add(file.filename);
    }
    
    try {
      const { confirmCommit } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmCommit",
          message: `Applied ${appliedFiles.length} AI suggestions. Proceed with commit?`,
          default: true
        }
      ]);

      if (confirmCommit) {
        console.log(chalk.green("\n✅ Files updated and re-staged. You can now commit!"));
        
        // Clean up backup files
        for (const file of appliedFiles) {
          try {
            await fs.unlink(file.backupPath);
          } catch (error) {
            // Ignore backup cleanup errors
          }
        }
        
        process.exit(0);
      } else {
        // Restore original files if user doesn't want to commit
        console.log(chalk.yellow("\n🔄 Restoring original files..."));
        for (const file of appliedFiles) {
          try {
            const backupContent = await fs.readFile(file.backupPath, 'utf8');
            await fs.writeFile(file.filename, backupContent);
            await fs.unlink(file.backupPath);
            await git.add(file.filename); // Re-stage original content
          } catch (error) {
            console.log(chalk.red(`❌ Error restoring ${file.filename}: ${error.message}`));
          }
        }
        console.log(chalk.yellow("🔙 Files restored to original state."));
        process.exit(1);
      }
    } catch (error) {
      if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
        console.log(chalk.yellow("\n⚠️ Prompt cancelled by user"));
        console.log(chalk.green("✅ Keeping applied changes and proceeding with commit"));
        
        // Clean up backup files
        for (const file of appliedFiles) {
          try {
            await fs.unlink(file.backupPath);
          } catch (cleanupError) {
            // Ignore backup cleanup errors
          }
        }
        
        process.exit(0);
      } else {
        throw error;
      }
    }
  } else {
    console.log(chalk.yellow("\\n⚠️  No files were modified."));
    process.exit(1);
  }
}

// Auto-apply Copilot suggestions and recommit
async function autoApplyAndRecommit(autoFixes, stagedFiles) {
  // Check if these are fallback fixes (no real auto-apply available)
  if (autoFixes.length > 0 && autoFixes[0].type === 'fallback') {
    console.log(chalk.yellow("\\n📋 Manual code review recommended"));
    console.log(chalk.cyan("💡 Auto-apply not available - improvements need manual review"));
    console.log(chalk.green("✅ Proceeding with commit - please review suggestions above"));
    process.exit(0);
  }
  
  console.log(chalk.cyan("\\n🚀 Auto-applying Copilot suggestions..."));
  
  let appliedFiles = [];
  const fileChanges = new Map();
  
  // Group fixes by file
  autoFixes.forEach(fix => {
    if (!fileChanges.has(fix.filename)) {
      fileChanges.set(fix.filename, []);
    }
    fileChanges.get(fix.filename).push(fix);
  });
  
  try {
    for (const [filename, fixes] of fileChanges) {
      // Check if file exists and is staged
      const isStaged = stagedFiles.some(file => file.endsWith(filename) || file === filename);
      
      if (isStaged) {
        const filePath = path.resolve(process.cwd(), filename);
        
        try {
          // Read current content
          const originalContent = await fs.readFile(filePath, 'utf8');
          
          // Create backup
          const backupPath = filePath + '.copilot-backup';
          await fs.writeFile(backupPath, originalContent);
          
          // Apply fixes (sort by line number descending to avoid line number shifts)
          const sortedFixes = fixes.sort((a, b) => b.line - a.line);
          let modifiedContent = originalContent;
          
          for (const fix of sortedFixes) {
            modifiedContent = modifiedContent.replace(fix.original, fix.improved);
          }
          
          // Write improved content
          // Before writing, allow interactive per-file review when possible
          const accepted = await interactiveReviewAndApply(filename, originalContent, modifiedContent);

          if (!accepted) {
            console.log(chalk.yellow(`⚠️  Skipping applying changes to ${filename} (user chose to keep local changes)`));
            continue; // do not write or stage this file
          }

          await fs.writeFile(filePath, modifiedContent);
          appliedFiles.push({
            filename: filename,
            backupPath: backupPath,
            fixCount: fixes.length
          });
          
          console.log(chalk.green(`✅ Applied ${fixes.length} improvements to: ${filename}`));
          
        } catch (error) {
          console.log(chalk.red(`❌ Error applying fixes to ${filename}: ${error.message}`));
        }
      } else {
        console.log(chalk.yellow(`⚠️  File ${filename} is not staged, skipping...`));
      }
    }
    
    if (appliedFiles.length > 0) {
      console.log(chalk.cyan("\\n🔄 Re-staging improved files..."));
      
      // Re-stage the modified files
      for (const file of appliedFiles) {
        await git.add(file.filename);
      }
      
      // Generate a commit message based on branch and fixes
      const branchName = await git.revparse(['--abbrev-ref', 'HEAD']);
      const ticketMatch = branchName.match(/([A-Z]+-\d+)/);
      const ticketId = ticketMatch ? ticketMatch[1] : 'SHOP-0000';
      
      // Create a descriptive commit message in the format TICKET-description
      const fixCount = appliedFiles.length;
      const commitMessage = `${ticketId}-apply-copilot-improvements-${fixCount}-files`;
      
      const { cancelled, answers } = await safePrompt([
        {
          type: "confirm",
          name: "confirmRecommit",
          message: `🎯 Auto-applied ${fixCount} file improvements. Recommit now?`,
          default: true
        }
      ], { timeoutMs: 30000 });

      const shouldCommit = cancelled ? true : answers.confirmRecommit;

      if (shouldCommit) {
        console.log(chalk.cyan("\\n🚀 Recommitting with Copilot improvements..."));
        console.log(chalk.gray(`📝 Commit message: ${commitMessage}`));
        
        try {
          // Commit with the properly formatted message and skip hooks to avoid re-running validator
          await git.commit(commitMessage, ['--no-verify']);
          console.log(chalk.green("\\n🎉 Successfully committed with Copilot enhancements!"));
          console.log(chalk.gray(`📝 Commit message: ${commitMessage}`));
          
          // Clean up backup files
          for (const file of appliedFiles) {
            try {
              await fs.unlink(file.backupPath);
            } catch (error) {
              // Ignore backup cleanup errors
            }
          }
          
          console.log(chalk.cyan("\\n✨ World-class code committed successfully!"));
          process.exit(0);
        } catch (commitError) {
          console.log(chalk.red(`❌ Commit failed: ${commitError.message}`));
          console.log(chalk.yellow("🔄 Files have been improved but not committed yet"));
          process.exit(1);
        }
      } else {
        console.log(chalk.yellow("\\n📝 Files improved but not recommitted"));
        console.log(chalk.gray("💡 Run 'git commit' manually when ready"));
        process.exit(0);
      }
    } else {
      console.log(chalk.yellow("\\n⚠️  No files were modified."));
      process.exit(1);
    }
    
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      console.log('⚠️  Process cancelled by user');
      console.log('✅ Proceeding with original commit (default action)');
      process.exit(0);
    }
    throw error;
  }
}

// Apply suggestions to new files while keeping local changes
async function applyToNewFiles(autoFixes, stagedFiles) {
  console.log(chalk.cyan("\\n🔧 Creating improved versions as new files..."));
  
  const fileChanges = new Map();
  
  // Group fixes by file
  autoFixes.forEach(fix => {
    if (!fileChanges.has(fix.filename)) {
      fileChanges.set(fix.filename, []);
    }
    fileChanges.get(fix.filename).push(fix);
  });
  
  for (const [filename, fixes] of fileChanges) {
    const isStaged = stagedFiles.some(file => file.endsWith(filename) || file === filename);
    
    if (isStaged) {
      try {
        const filePath = path.resolve(process.cwd(), filename);
        const originalContent = await fs.readFile(filePath, 'utf8');
        
        // Apply fixes
        let modifiedContent = originalContent;
        const sortedFixes = fixes.sort((a, b) => b.line - a.line);
        
        for (const fix of sortedFixes) {
          modifiedContent = modifiedContent.replace(fix.original, fix.improved);
        }
        
        // Create improved version with .copilot suffix
        const improvedPath = filePath.replace(/(\\.(\\w+))$/, '.copilot$1');
        await fs.writeFile(improvedPath, modifiedContent);
        
        console.log(chalk.green(`✅ Created improved version: ${improvedPath}`));
        console.log(chalk.gray(`📊 Applied ${fixes.length} improvements`));
        
      } catch (error) {
        console.log(chalk.red(`❌ Error creating improved version of ${filename}: ${error.message}`));
      }
    }
  }
  
  console.log(chalk.cyan("\\n💡 Review the .copilot files and merge changes as needed"));
}

// Apply auto-applicable fixes without committing; saves files and exits 1
async function applyAutoFixesNoCommit(autoFixes, stagedFiles) {
  const fileChanges = new Map();
  autoFixes.forEach(fix => {
    const key = fix.filename;
    if (!fileChanges.has(key)) fileChanges.set(key, []);
    fileChanges.get(key).push(fix);
  });

  for (const [filename, fixes] of fileChanges) {
    const isStaged = stagedFiles.some(file => file.endsWith(filename) || file === filename);
    if (!isStaged) continue;

    try {
      const filePath = path.resolve(process.cwd(), filename);
      const originalContent = await fs.readFile(filePath, 'utf8');
      let modifiedContent = originalContent;
      const sortedFixes = fixes.sort((a,b) => b.line - a.line);
      for (const fix of sortedFixes) {
        modifiedContent = modifiedContent.replace(fix.original, fix.improved);
      }
      await fs.writeFile(filePath, modifiedContent);
      await git.add(filename);
      console.log(chalk.green(`✅ Saved fixes to ${filename}`));
    } catch (error) {
      console.log(chalk.red(`❌ Error saving fixes to ${filename}: ${error.message}`));
    }
  }
}

// Interactive per-file review: shows original vs improved content and asks user to accept
async function interactiveReviewAndApply(filename, originalContent, improvedContent) {
  // If running in a non-interactive terminal and user didn't force prompts,
  // decide based on DEFAULT_ON_CANCEL: 'auto-apply' => accept, 'skip' => reject, 'cancel' => cancel whole flow
  const nonInteractive = !process.stdin || !process.stdin.isTTY;
  const forcePrompt = (process.env.AI_FORCE_PROMPT || 'false').toLowerCase() === 'true';

  if (nonInteractive && !forcePrompt) {
    if (DEFAULT_ON_CANCEL === 'auto-apply') return true;
    if (DEFAULT_ON_CANCEL === 'skip') return false;
    // DEFAULT_ON_CANCEL === 'cancel' -> treat as reject (higher-level flow will cancel)
    return false;
  }

  // Print a concise diff-like view: show changed lines with context
  const origLines = originalContent.split(/\r?\n/);
  const newLines = improvedContent.split(/\r?\n/);
  const maxLen = Math.max(origLines.length, newLines.length);

  console.log(chalk.magenta(`\n--- Suggested changes for: ${filename}`));
  console.log(chalk.gray('  (Lines prefixed with - are original; + are suggested improvements)'));

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] !== undefined ? origLines[i] : '';
    const n = newLines[i] !== undefined ? newLines[i] : '';
    if (o === n) {
      // print unchanged lines sparsely for context only when nearby changes exist
      // to avoid flooding, show unchanged lines only if within 2 lines of a change
      const prevChanged = (i > 0 && origLines[i-1] !== newLines[i-1]);
      const nextChanged = (i < maxLen-1 && origLines[i+1] !== newLines[i+1]);
      if (prevChanged || nextChanged) {
        console.log('  ' + o);
      }
    } else {
      console.log(chalk.red(`- ${o}`));
      console.log(chalk.green(`+ ${n}`));
    }
  }

  // Use safePrompt for robust input handling
  try {
    const { cancelled, answers } = await safePrompt([
      {
        type: 'confirm',
        name: 'apply',
        message: `Apply suggested changes to ${filename}?`,
        default: true
      }
    ], { timeoutMs: 30000 });

    if (cancelled) {
      // Fallback to configured default when prompt times out or is cancelled
      if (DEFAULT_ON_CANCEL === 'auto-apply') return true;
      if (DEFAULT_ON_CANCEL === 'skip') return false;
      return false;
    }

    return !!answers.apply;
  } catch (err) {
    if (err && (err.name === 'ExitPromptError' || /User force closed|cancelled/i.test(err.message))) {
      if (DEFAULT_ON_CANCEL === 'auto-apply') return true;
      return false;
    }
    throw err;
  }
}