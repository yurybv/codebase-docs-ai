import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOpenAiCompatibleProviderFromEnv } from '@codebase-docs-ai/ai-orchestrator';
import { DocumentationEngine } from '@codebase-docs-ai/core';
import { renderZip } from '@codebase-docs-ai/renderers';
import type { DocumentationOutputFormat, LoadedSource, RenderedDocumentation } from '@codebase-docs-ai/shared';
import { loadArchiveSource, loadFolderSource } from '@codebase-docs-ai/source-loader';
import { parseCliSourceInput, type GenerateCommandOptions } from './cli-options.js';

export interface GenerateCommandResult {
  status: 'completed';
  outputPath: string;
  format: GenerateCommandOptions['format'];
  sourceCount: number;
  fileCount: number;
  files: string[];
}

export async function runGenerateCommand(options: GenerateCommandOptions): Promise<GenerateCommandResult> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-'));

  try {
    const loadedSources = await Promise.all(
      options.source.map((sourceInput) => loadCliSource(sourceInput, tempRoot))
    );
    const engine = createDocumentationEngine();
    const engineResult = await engine.generateDocumentation({
      title: options.name,
      loadedSources,
      options: {
        outputFormats: [coreOutputFormat(options.format)],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const renderedDocumentation = engineResult.rendered.get(coreOutputFormat(options.format));
    if (!renderedDocumentation) {
      throw new Error(`Documentation output was not rendered for format: ${options.format}`);
    }

    const writtenFiles = await writeOutput({
      renderedDocumentation,
      outputPath: options.output,
      zip: options.format === 'zip'
    });

    return {
      status: 'completed',
      outputPath: path.resolve(options.output),
      format: options.format,
      sourceCount: loadedSources.length,
      fileCount: writtenFiles.length,
      files: writtenFiles
    };
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
}

function createDocumentationEngine(): DocumentationEngine {
  const aiProvider = createOpenAiCompatibleProviderFromEnv();
  return new DocumentationEngine(aiProvider ? { aiProvider } : {});
}

async function loadCliSource(sourceInput: string, tempRoot: string): Promise<LoadedSource> {
  const parsedSource = parseCliSourceInput(sourceInput);
  const inputPath = path.resolve(parsedSource.inputPath);
  const inputStat = await stat(inputPath);

  if (inputStat.isDirectory()) {
    return loadFolderSource({
      source: parsedSource.metadata,
      folderPath: inputPath
    });
  }

  if (inputStat.isFile()) {
    return loadArchiveSource({
      source: parsedSource.metadata,
      archivePath: inputPath,
      extractionRoot: path.join(tempRoot, 'extracted')
    });
  }

  throw new Error(`Unsupported source path type: ${parsedSource.inputPath}`);
}

function coreOutputFormat(format: GenerateCommandOptions['format']): DocumentationOutputFormat {
  return format === 'zip' ? 'markdown-tree' : format;
}

async function writeOutput(input: {
  renderedDocumentation: RenderedDocumentation;
  outputPath: string;
  zip: boolean;
}): Promise<string[]> {
  const outputRoot = path.resolve(input.outputPath);
  await mkdir(outputRoot, {
    recursive: true
  });

  if (input.zip) {
    const zipPath = path.join(outputRoot, 'documentation.zip');
    await writeFile(zipPath, renderZip(input.renderedDocumentation));
    return [zipPath];
  }

  const writtenFiles: string[] = [];
  for (const file of input.renderedDocumentation.files) {
    const targetPath = assertOutputPathInsideRoot(outputRoot, file.path);
    await mkdir(path.dirname(targetPath), {
      recursive: true
    });
    await writeFile(targetPath, file.content, 'utf8');
    writtenFiles.push(targetPath);
  }

  return writtenFiles;
}

function assertOutputPathInsideRoot(outputRoot: string, relativeFilePath: string): string {
  const targetPath = path.resolve(outputRoot, relativeFilePath);
  if (targetPath !== outputRoot && !targetPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`Rendered file escapes output directory: ${relativeFilePath}`);
  }

  return targetPath;
}
