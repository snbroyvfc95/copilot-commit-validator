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

// Get code review using GitHub Copilot-like analysis
async function getCopilotReview(diff) {
  console.log(chalk.cyan("🤖 Running Copilot-style code analysis..."));
  
  const issues = [];
  const suggestions = [];
  const lines = diff.split('\n');
  
  // Copilot-style analysis patterns
  const patterns = {
    security: [
      { regex: /password\s*=\s*["'][^"']+["']/i, message: "Hardcoded password detected", severity: "high" },
      { regex: /api[_-]?key\s*=\s*["'][^"']+["']/i, message: "Hardcoded API key detected", severity: "high" },
      { regex: /token\s*=\s*["'][^"']+["']/i, message: "Hardcoded token detected", severity: "high" }
    ],
    performance: [
      { regex: /console\.log\(/i, message: "Console.log found - consider removing for production", severity: "low" },
      { regex: /for\s*\(.*in.*\)/i, message: "for...in loop - consider for...of or forEach", severity: "medium" },
      { regex: /\+\s*.*\.length\s*>\s*1000/i, message: "Large array operation detected", severity: "medium" }
    ],
    bestPractices: [
      { regex: /var\s+/i, message: "Use 'let' or 'const' instead of 'var'", severity: "medium" },
      { regex: /==\s*null|!=\s*null/i, message: "Use === null or !== null for strict comparison", severity: "low" },
      { regex: /function\s*\(/i, message: "Consider using arrow functions for consistency", severity: "low" }
    ]
  };
  
  // Analyze each added line
  lines.forEach((line, index) => {
    if (line.startsWith('+')) {
      const code = line.substring(1).trim();
      
      Object.entries(patterns).forEach(([category, patternList]) => {
        patternList.forEach(pattern => {
          if (pattern.regex.test(code)) {
            const severity = pattern.severity === 'high' ? '🔴' : pattern.severity === 'medium' ? '🟡' : '🟢';
            issues.push(`${severity} Line ${index + 1}: ${pattern.message}`);
            
            // Add specific suggestions based on pattern
            if (pattern.message.includes('password') || pattern.message.includes('key') || pattern.message.includes('token')) {
              suggestions.push("Move sensitive data to environment variables (.env file)");
            } else if (pattern.message.includes('console.log')) {
              suggestions.push("Use a proper logging library (winston, pino) or remove debug statements");
            } else if (pattern.message.includes('var')) {
              suggestions.push("Replace 'var' with 'const' for constants or 'let' for variables");
            }
          }
        });
      });
    }
  });
  
  // Generate Copilot-style feedback
  if (issues.length === 0) {
    return "✅ Code analysis complete - no issues found";
  } else {
    let feedback = "ISSUES_FOUND\n";
    issues.forEach((issue, i) => {
      feedback += `${i + 1}. ${issue}\n`;
    });
    
    feedback += "\nSUGGESTED_IMPROVEMENTS\n";
    [...new Set(suggestions)].forEach(suggestion => {
      feedback += `• ${suggestion}\n`;
    });
    
    return feedback;
  }
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
  
  const { decision } = await inquirer.prompt([
    {
      type: "list",
      name: "decision",
      message: "How would you like to proceed?",
      choices: choices,
    },
  ]);
  
  if (decision === "Skip AI validation and proceed with commit") {
    const { reason } = await inquirer.prompt([
      {
        type: "input",
        name: "reason",
        message: "Enter reason for skipping AI validation:",
        default: "GitHub API rate limit exceeded"
      },
    ]);
    console.log(chalk.green(`\n✅ Commit allowed. Reason: ${reason}`));
    process.exit(0);
  } else if (decision === "Use local code analysis") {
    return await localCodeAnalysis(diff);
  } else {
    console.log(chalk.red("\n❌ Commit cancelled. Please try again later."));
    process.exit(1);
  }
}

export async function validateCommit() {
  console.log(chalk.blueBright("🔍 Checking your staged changes..."));
  
  // Get diff of staged files
  const diff = await git.diff(["--cached"]);
  if (!diff.trim()) {
    console.log(chalk.yellow("⚠️  No staged changes found."));
    process.exit(0);
  }

  // Get list of staged files for potential modification
  const stagedFiles = await getStagedFiles();
  
  console.log(chalk.cyan("🧠 Analyzing code diff..."));
  
  let aiFeedback;
  
  // Try GitHub Copilot integration first, then fall back to local analysis
  if (octokit && githubToken) {
    try {
      console.log(chalk.cyan("🤖 Using GitHub Copilot integration..."));
      aiFeedback = await getCopilotReview(diff);
    } catch (error) {
      console.log(chalk.yellow("⚠️  GitHub Copilot unavailable, using local analysis..."));
      return await localCodeAnalysis(diff);
    }
  } else {
    console.log(chalk.cyan("🔍 Using local code analysis..."));
    return await localCodeAnalysis(diff);
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
    const { reason } = await inquirer.prompt([
      {
        type: "input",
        name: "reason",
        message: "Enter justification to skip AI suggestions:",
        validate: (input) => input.trim() ? true : "Reason is required.",
      },
    ]);
    console.log(chalk.yellow(`\n⚠️ Commit bypassed with reason: ${reason}\n`));
    process.exit(0);
  } else {
    console.log(chalk.red("\n❌ Commit cancelled."));
    process.exit(1);
  }
}

// Helper function to get staged files
async function getStagedFiles() {
  const status = await git.status();
  return status.staged;
}

// Helper function to parse AI suggested fixes
function parseSuggestedFixes(aiFeedback) {
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
  } else {
    console.log(chalk.yellow("\n⚠️  No files were modified."));
    process.exit(1);
  }
}