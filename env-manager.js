#!/usr/bin/env node

// Environment Variable Manager for AI Commit Validator
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
config({ path: '.env.local' });
config();

function checkEnvironment() {
  console.log(chalk.blue('\n🔍 AI Commit Validator - Environment Check\n'));

  const requiredVars = [
    { name: 'OPENAI_API_KEY', type: 'secret', required: true },
  ];

  const optionalVars = [
    { name: 'OPENAI_MODEL', type: 'config', default: 'gpt-4o-mini' },
    { name: 'OPENAI_MAX_TOKENS', type: 'config', default: '1000' },
    { name: 'NODE_ENV', type: 'config', default: 'development' },
    { name: 'LOG_LEVEL', type: 'config', default: 'info' },
    { name: 'API_TIMEOUT', type: 'config', default: '30000' },
  ];

  let hasErrors = false;

  // Check required variables
  console.log(chalk.yellow('📋 Required Variables:'));
  requiredVars.forEach(({ name, type }) => {
    const value = process.env[name];
    if (value) {
      if (type === 'secret') {
        console.log(chalk.green(`  ✅ ${name}: ***${value.slice(-4)} (${value.length} chars)`));
      } else {
        console.log(chalk.green(`  ✅ ${name}: ${value}`));
      }
    } else {
      console.log(chalk.red(`  ❌ ${name}: Not set`));
      hasErrors = true;
    }
  });

  // Check optional variables
  console.log(chalk.yellow('\n⚙️  Optional Variables:'));
  optionalVars.forEach(({ name, type, default: defaultValue }) => {
    const value = process.env[name] || defaultValue;
    const isDefault = !process.env[name];
    const status = isDefault ? chalk.gray('(default)') : chalk.blue('(set)');
    console.log(chalk.cyan(`  📝 ${name}: ${value} ${status}`));
  });

  // Check environment files
  console.log(chalk.yellow('\n📁 Environment Files:'));
  const envFiles = ['.env.local', '.env', '.env.example'];
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(chalk.green(`  ✅ ${file}: Found`));
    } else {
      console.log(chalk.gray(`  ➖ ${file}: Not found`));
    }
  });

  // Summary
  console.log(chalk.yellow('\n📊 Summary:'));
  if (hasErrors) {
    console.log(chalk.red('  ❌ Configuration incomplete'));
    console.log(chalk.yellow('  💡 Add missing variables to .env.local or system environment'));
  } else {
    console.log(chalk.green('  ✅ Configuration complete'));
    console.log(chalk.blue('  🚀 Ready to use AI Commit Validator'));
  }

  // GitHub setup reminder
  if (process.env.GITHUB_ACTIONS !== 'true') {
    console.log(chalk.cyan('\n🔗 GitHub Setup:'));
    console.log(chalk.white('  For GitHub hosting, add these secrets to your repository:'));
    console.log(chalk.gray('  • OPENAI_API_KEY (in Secrets)'));
    console.log(chalk.gray('  • OPENAI_MODEL, LOG_LEVEL, etc. (in Variables)'));
  }

  return !hasErrors;
}

function createLocalEnv() {
  const envLocalExists = fs.existsSync('.env.local');
  if (envLocalExists) {
    console.log(chalk.yellow('📝 .env.local already exists'));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';
  const envContent = `# Local development environment variables
OPENAI_API_KEY=${apiKey}
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=1000
NODE_ENV=development
LOG_LEVEL=debug
API_TIMEOUT=30000
`;

  fs.writeFileSync('.env.local', envContent);
  console.log(chalk.green('✅ Created .env.local file'));
  console.log(chalk.yellow('💡 Update the API key in .env.local with your actual key'));
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check':
    case undefined:
      checkEnvironment();
      break;
    case 'create':
      createLocalEnv();
      break;
    case 'help':
      console.log(chalk.blue('\n🔧 AI Commit Validator - Environment Manager\n'));
      console.log('Usage: node env-manager.js [command]\n');
      console.log('Commands:');
      console.log('  check   - Check current environment configuration (default)');
      console.log('  create  - Create .env.local template');
      console.log('  help    - Show this help message');
      break;
    default:
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      console.log(chalk.yellow('💡 Use "help" to see available commands'));
      process.exit(1);
  }
}

main();