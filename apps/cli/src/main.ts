#!/usr/bin/env node
import { Command } from 'commander';
import { formatCliError } from './cli-error.js';
import { collectRepeatedOption, parseGenerateOptions, parseListRunsOptions } from './cli-options.js';
import { runGenerateCommand } from './generate-command.js';
import { runListRunsCommand } from './list-runs-command.js';

const program = new Command();

program
  .name('codebase-docs-ai')
  .description('Generate technical documentation from source archives and folders.')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate documentation from source inputs.')
  .option('-s, --source <source>', 'Source in the form path:role. Repeat for multiple sources.', collectRepeatedOption, [])
  .option('--output <path>', 'Output directory', './generated-docs')
  .option('--format <format>', 'Output format: markdown-tree, single-markdown, json, or zip', 'markdown-tree')
  .option('--name <name>', 'Documentation title', 'Generated Project Documentation')
  .option('--api-url <url>', 'Run through a remote codebase-docs-ai API instead of local analysis')
  .action(async (options: { source?: string[]; output?: string; format?: string; name?: string; apiUrl?: string }) => {
    const result = await runGenerateCommand(parseGenerateOptions(options));
    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );
  });

program
  .command('list-runs')
  .description('List recent documentation runs from a remote API.')
  .option('--api-url <url>', 'Remote codebase-docs-ai API URL')
  .option('--limit <count>', 'Maximum number of recent runs to list, from 1 to 100')
  .action(async (options: { apiUrl?: string; limit?: string }) => {
    const result = await runListRunsCommand(parseListRunsOptions(options));
    console.log(JSON.stringify(result, null, 2));
  });

try {
  await program.parseAsync();
} catch (error) {
  const failure = formatCliError(error);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = failure.exitCode;
}
