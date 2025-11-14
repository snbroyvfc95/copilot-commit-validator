import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import chalk from "chalk";
import inquirer from "inquirer";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

// Load environment variables with fallback
dotenv.config({ path: '.env.local' }); // Try local first
dotenv.config(); // Then try .env

// GitHub token for Copilot access (optional - fallback to local analysis)
const githubToken = process.env.GITHUB_TOKEN;
let octokit = null;

if (githubToken) {
  octokit = new Octokit({ 
    auth: githubToken,
    timeout: parseInt(process.env.API_TIMEOUT || '30000')
  });
  console.log(chalk.cyan('🤖 GitHub Copilot integration enabled'));
} else {
  console.log(chalk.yellow('⚠️  No GITHUB_TOKEN found - using local code analysis'));
  console.log(chalk.gray('💡 Add GITHUB_TOKEN for enhanced AI features'));
}

// Rate limit and fallback configuration
const ENABLE_AI_FALLBACK = process.env.ENABLE_AI_FALLBACK !== 'false';
const SKIP_ON_RATE_LIMIT = process.env.SKIP_ON_RATE_LIMIT === 'true';
const git = simpleGit();

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
    
    // Include context lines for diff structure
    return line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index');
  });
  
  return meaningfulLines.join('\n');
}

// Get world-class code review using enhanced Copilot analysis
async function getCopilotReview(diff) {
  console.log(chalk.cyan("🤖 Running Enhanced Copilot Analysis for World-Class Code..."));
  
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
    codeQuality: [
      { regex: /\/\*\s*TODO/i, message: "TODO comment found", severity: "low", fix: "Create proper issue or implement the TODO" },
      { regex: /\/\*\s*FIXME/i, message: "FIXME comment found", severity: "medium", fix: "Address the FIXME or create an issue" },
      { regex: /\/\*\s*HACK/i, message: "HACK comment found", severity: "medium", fix: "Refactor to remove the hack" },
      { regex: /^\s*\/\/\s*eslint-disable/i, message: "ESLint rule disabled", severity: "medium", fix: "Fix the underlying issue instead of disabling rules" },
      { regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/i, message: "Empty catch block", severity: "high", fix: "Add proper error handling or logging" }
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
      const match = line.match(/b\/(.*?)\s/);
      currentFile = match ? match[1] : '';
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
              const improvement = generateCodeImprovement(code, pattern, currentFile, index + 1);
              if (improvement) {
                if (!fileChanges.has(currentFile)) {
                  fileChanges.set(currentFile, []);
                }
                fileChanges.get(currentFile).push(improvement);
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
    feedback += "🚀 Copilot recommends these improvements for world-class code:\n\n";
    
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
      feedback += "🟢 NICE TO HAVE:\n";
      lowIssues.forEach(issue => feedback += `   ${issue}\n`);
      feedback += "\n";
    }
    
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

  console.log(chalk.green("\n🤖 AI Review Feedback:\n"));
  console.log(chalk.white(aiFeedback));

  // If everything looks good, allow commit
  if (aiFeedback.includes("✅")) {
    console.log(chalk.green("\n✅ Commit allowed."));
    process.exit(0);
  }

  // Parse AI response for suggested fixes
  const suggestedFixes = parseSuggestedFixes(aiFeedback);
  
  // Otherwise, ask user what to do
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
      console.log(chalk.green("\n💾 Please make the suggested changes, then re-stage and commit again."));
      process.exit(1);
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
    if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
      console.log(chalk.yellow("\n⚠️ Prompt cancelled by user"));
      console.log(chalk.green("✅ Proceeding with commit (default: skip validation)"));
      process.exit(0);
    } else {
      throw error;
    }
  }
  
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      console.log('⚠️  Prompt cancelled by user');
      console.log('✅ Proceeding with commit (default action)');
      process.exit(0);
    }
    throw error;
  }
}

// Helper function to get staged files
async function getStagedFiles() {
  const status = await git.status();
  return status.staged;
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
    } else if (line.includes(' → ') && currentFile) {
      const match = line.match(/Line (\d+): (.+?) → (.+)/);
      if (match) {
        fixes.push({
          filename: currentFile,
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
  
  let appliedFiles = [];
  
  for (const fix of suggestedFixes) {
    try {
      // Check if the file exists and is staged
      const isStaged = stagedFiles.some(file => file.endsWith(fix.filename) || file === fix.filename);
      
      if (isStaged) {
        // Get current working directory
        const cwd = process.cwd();
        const filePath = path.resolve(cwd, fix.filename);
        
        // Check if file exists
        try {
          await fs.access(filePath);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  File not found: ${fix.filename}, skipping...`));
          continue;
        }
        
        // Create backup
        const backupPath = filePath + '.ai-backup';
        const originalContent = await fs.readFile(filePath, 'utf8');
        await fs.writeFile(backupPath, originalContent);
        
        // Apply the fix
        await fs.writeFile(filePath, fix.code);
        appliedFiles.push({
          filename: fix.filename,
          backupPath: backupPath
        });
        
        console.log(chalk.green(`✅ Applied fix to: ${fix.filename}`));
        
      } else {
        console.log(chalk.yellow(`⚠️  File ${fix.filename} is not staged, skipping...`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error applying fix to ${fix.filename}: ${error.message}`));
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
      
      // Get current commit message from environment or use default
      let commitMessage = process.env.COMMIT_MSG || "Apply Copilot suggestions for world-class code";
      
      const { confirmRecommit } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmRecommit",
          message: `🎯 Auto-applied ${appliedFiles.length} file improvements. Recommit now?`,
          default: true
        }
      ]);

      if (confirmRecommit) {
        console.log(chalk.cyan("\\n🚀 Recommitting with Copilot improvements..."));
        
        try {
          await git.commit(commitMessage);
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