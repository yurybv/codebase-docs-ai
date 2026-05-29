#!/usr/bin/env node
import { Command } from 'commander';
import { collectRepeatedOption, parseGenerateOptions } from './cli-options.js';
import { runGenerateCommand } from './generate-command.js';

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
  .action(async (options: { source?: string[]; output?: string; format?: string; name?: string }) => {
    const result = await runGenerateCommand(parseGenerateOptions(options));
    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Unknown CLI error.'
        }
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
