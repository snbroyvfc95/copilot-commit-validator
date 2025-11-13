import OpenAI from "openai";
import simpleGit from "simple-git";
import chalk from "chalk";
import inquirer from "inquirer";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

// Load environment variables with fallback
dotenv.config({ path: '.env.local' }); // Try local first
dotenv.config(); // Then try .env

// Validate OpenAI API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY environment variable is required.');
  console.error('💡 For local development: Add it to .env.local file');
  console.error('💡 For GitHub Actions: Add it as a repository secret');
  process.exit(1);
}

// Initialize OpenAI with configuration from environment
const openai = new OpenAI({ 
  apiKey: apiKey,
  timeout: parseInt(process.env.API_TIMEOUT || '30000')
});
const git = simpleGit();
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
  
  console.log(chalk.cyan("🧠 Sending code diff to AI for review..."));
  
  const prompt = `
  You are a senior code reviewer and code assistant.
  Review the following git diff and provide suggestions.
  
  If everything looks good, respond with: "✅ Looks good".
  
  If you find issues, provide your response in this EXACT format:
  
  ISSUES_FOUND
  1. [Issue description]
  2. [Issue description]
  
  SUGGESTED_FIXES
  For file: [filename]
  \`\`\`
  [complete corrected code for the file]
  \`\`\`
  
  For file: [filename2]
  \`\`\`
  [complete corrected code for the file]
  \`\`\`
  
  Git diff:
  ${diff}
  `;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
  });

  const aiFeedback = response.choices[0].message.content;
  console.log(chalk.green("\n🤖 AI Review Feedback:\n"));
  console.log(chalk.white(aiFeedback));

  // If everything looks good, allow commit
  if (aiFeedback.includes("✅ Looks good")) {
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