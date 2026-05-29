#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('codebase-docs-ai')
  .description('Generate technical documentation from source archives and folders.')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate documentation from source inputs.')
  .option('--source <source...>', 'Source in the form path:role')
  .option('--output <path>', 'Output directory', './generated-docs')
  .option('--format <format>', 'Output format', 'markdown-tree')
  .action((options: { source?: string[]; output: string; format: string }) => {
    const sourceCount = options.source?.length ?? 0;
    console.log(
      JSON.stringify(
        {
          status: 'not_implemented',
          sourceCount,
          output: options.output,
          format: options.format
        },
        null,
        2
      )
    );
  });

program.parse();
