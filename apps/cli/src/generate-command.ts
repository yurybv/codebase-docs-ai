import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateDocumentationTree } from '@codebase-docs-ai/documentation-generator';
import { renderJson, renderMarkdownTree, renderSingleMarkdown, renderZip } from '@codebase-docs-ai/renderers';
import { analyzeRepository } from '@codebase-docs-ai/repo-analyzer';
import { filterLoadedSource } from '@codebase-docs-ai/security';
import type { DocumentationTree, LoadedSource, RenderedDocumentation } from '@codebase-docs-ai/shared';
import { loadArchiveSource, loadFolderSource } from '@codebase-docs-ai/source-loader';
import { analyzeSystem } from '@codebase-docs-ai/system-analyzer';
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
    const repositoryMaps = await Promise.all(
      loadedSources.map((loadedSource) => {
        const filteredSource = filterLoadedSource(loadedSource);
        return analyzeRepository({
          source: loadedSource.source,
          rootPath: loadedSource.rootPath,
          files: filteredSource.includedFiles
        });
      })
    );
    const systemMap = analyzeSystem({
      repositories: repositoryMaps
    });
    const documentationTree = generateDocumentationTree({
      title: options.name,
      systemMap
    });
    const writtenFiles = await writeOutput({
      renderedDocumentation: renderForCliFormat(documentationTree, options.format),
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

function renderForCliFormat(
  documentationTree: DocumentationTree,
  format: GenerateCommandOptions['format']
): RenderedDocumentation {
  if (format === 'markdown-tree' || format === 'zip') {
    return renderMarkdownTree(documentationTree);
  }

  if (format === 'single-markdown') {
    return renderSingleMarkdown(documentationTree);
  }

  return renderJson(documentationTree);
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
