#!/usr/bin/env node

/**
 * AI Ops Prompt IDE - CLI Entry Point
 * Multi-provider AI image classification tool
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { classifyCommand } from './commands/classify';
import { compareCommand } from './commands/compare';
import { batchCommand } from './commands/batch';
import { costsCommand } from './commands/costs';

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };

const program = new Command();

program
  .name('prompt-ide')
  .description('CLI tool for multi-provider AI image classification')
  .version(packageJson.version);

// Classify command
program
  .command('classify')
  .description('Classify a single image')
  .argument('<image>', 'Path to image file')
  .option('-p, --provider <provider>', 'AI provider to use', 'gemini')
  .option('-o, --output <path>', 'Output file for results (JSON)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-cache', 'Disable result caching')
  .action(classifyCommand);

// Compare command
program
  .command('compare')
  .description('Compare classification results across multiple providers')
  .argument('<image>', 'Path to image file')
  .option('-p, --providers <providers>', 'Comma-separated list of providers to compare (default: all)')
  .option('-o, --output <path>', 'Output file for results (JSON)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-cache', 'Disable result caching')
  .action(compareCommand);

// Batch command
program
  .command('batch')
  .description('Process multiple images in batch')
  .argument('<source>', 'Directory path or input file (CSV/JSON/JSONL)')
  .option('-p, --provider <provider>', 'AI provider to use', 'gemini')
  .option('-i, --input <path>', 'Input file (CSV/JSON/JSONL) - deprecated, use source argument')
  .option('-o, --output <path>', 'Output file for results (JSONL)', 'batch-results.jsonl')
  .option('-c, --concurrency <number>', 'Max concurrent requests (default: provider-specific)')
  .option('--resume', 'Resume from previous session')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-r, --recursive', 'Scan directories recursively')
  .option('--no-cache', 'Disable result caching')
  .action(batchCommand);

// Costs command
program
  .command('costs')
  .description('View cost analytics, ROI analysis, and export cost data')
  .option('-p, --provider <provider>', 'Filter by specific provider')
  .option('-o, --output <path>', 'Export cost data to file')
  .option('-f, --format <format>', 'Export format (json|csv)', 'json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(costsCommand);

// Parse CLI arguments
program.parse();
