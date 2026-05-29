import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOpenAiCompatibleProviderFromEnv } from '@codebase-docs-ai/ai-orchestrator';
import { DocumentationEngine } from '@codebase-docs-ai/core';
import { renderZip } from '@codebase-docs-ai/renderers';
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';
import type { DocumentationOutputFormat, LoadedSource, RenderedDocumentation } from '@codebase-docs-ai/shared';
import { loadArchiveSource, loadFolderSource } from '@codebase-docs-ai/source-loader';
import { CliError } from './cli-error.js';
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
  if (options.apiUrl) {
    return runApiGenerateCommand(options);
  }

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
      throw new CliError(
        'CLI_RENDERED_OUTPUT_MISSING',
        `Documentation output was not rendered for format: ${options.format}`,
        1
      );
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

async function runApiGenerateCommand(options: GenerateCommandOptions): Promise<GenerateCommandResult> {
  if (!options.apiUrl) {
    throw new CliError('CLI_API_URL_REQUIRED', 'API URL is required for API mode.');
  }

  const client = new CodebaseDocsAIClient({
    apiBaseUrl: options.apiUrl
  });
  const sources = await Promise.all(options.source.map(loadApiArchiveSource));
  const result = await client.documentationRuns.generateFromArchives({
    name: options.name,
    options: {
      outputFormats: [coreOutputFormat(options.format)],
      language: 'en',
      includeSourceReferences: true,
      includeWarnings: true
    },
    sources,
    poll: {
      intervalMs: 1000,
      timeoutMs: 120000
    },
    downloadFormat: coreOutputFormat(options.format)
  });
  const downloadedFile = result.download
    ? await writeDownloadedOutput({
        outputPath: options.output,
        fileName: result.download.fileName ?? defaultDownloadFileName(options.format),
        content: result.download.content
      })
    : undefined;

  return {
    status: 'completed',
    outputPath: path.resolve(options.output),
    format: options.format,
    sourceCount: sources.length,
    fileCount: downloadedFile ? 1 : 0,
    files: downloadedFile ? [downloadedFile] : []
  };
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

  throw new CliError('CLI_SOURCE_PATH_UNSUPPORTED', `Unsupported source path type: ${parsedSource.inputPath}`);
}

async function loadApiArchiveSource(
  sourceInput: string
): Promise<{
  name: string;
  role: ReturnType<typeof parseCliSourceInput>['metadata']['role'];
  file: Blob;
  fileName: string;
}> {
  const parsedSource = parseCliSourceInput(sourceInput);
  const inputPath = path.resolve(parsedSource.inputPath);
  const inputStat = await stat(inputPath);
  if (!inputStat.isFile()) {
    throw new CliError(
      'CLI_API_SOURCE_MUST_BE_ARCHIVE',
      'API mode only accepts archive file sources. Use local mode for folder sources.'
    );
  }

  return {
    name: parsedSource.metadata.name,
    role: parsedSource.metadata.role,
    fileName: path.basename(inputPath),
    file: new Blob([await readFile(inputPath)])
  };
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

async function writeDownloadedOutput(input: {
  outputPath: string;
  fileName: string;
  content: Blob;
}): Promise<string> {
  const outputRoot = path.resolve(input.outputPath);
  await mkdir(outputRoot, {
    recursive: true
  });
  const targetPath = assertOutputPathInsideRoot(outputRoot, input.fileName);
  await writeFile(targetPath, Buffer.from(await input.content.arrayBuffer()));
  return targetPath;
}

function assertOutputPathInsideRoot(outputRoot: string, relativeFilePath: string): string {
  const targetPath = path.resolve(outputRoot, relativeFilePath);
  if (targetPath !== outputRoot && !targetPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new CliError(
      'CLI_OUTPUT_PATH_ESCAPE',
      `Rendered file escapes output directory: ${relativeFilePath}`,
      1
    );
  }

  return targetPath;
}

function defaultDownloadFileName(format: GenerateCommandOptions['format']): string {
  if (format === 'json') {
    return 'documentation-tree.json';
  }

  if (format === 'single-markdown') {
    return 'PROJECT_DOCUMENTATION.md';
  }

  return 'documentation.zip';
}
