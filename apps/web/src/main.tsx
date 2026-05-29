import React from 'react';
import ReactDOM from 'react-dom/client';
import { Download, FileArchive, Play, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import './styles.css';
import {
  buildSourceUploadMetadata,
  inferSourceName,
  type SourceDraft,
  type SourceRole
} from './source-metadata.js';

function App(): JSX.Element {
  const [sources, setSources] = useState<SourceDraft[]>([]);
  const [selectedPageKey, setSelectedPageKey] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>({
    status: 'idle'
  });

  const selectedPage = useMemo(() => {
    return runState.result?.documentation.pages.find((page) => page.key === selectedPageKey) ?? null;
  }, [runState.result, selectedPageKey]);

  function addFiles(fileList: FileList | null): void {
    if (!fileList) {
      return;
    }

    const newSources = Array.from(fileList).map((file, index) => ({
      id: `source_${Date.now()}_${index}`,
      name: inferSourceName(file.name) || file.name,
      role: 'unknown' as SourceRole,
      file
    }));

    setSources((currentSources) => [...currentSources, ...newSources]);
  }

  function updateSource(id: string, patch: Partial<Omit<SourceDraft, 'id' | 'file'>>): void {
    setSources((currentSources) =>
      currentSources.map((source) => (source.id === id ? { ...source, ...patch } : source))
    );
  }

  function removeSource(id: string): void {
    setSources((currentSources) => currentSources.filter((source) => source.id !== id));
  }

  async function generateDocumentation(): Promise<void> {
    if (sources.length === 0) {
      setRunState({
        status: 'failed',
        message: 'Upload at least one archive before generating documentation.'
      });
      return;
    }

    try {
      setRunState({
        status: 'creating',
        message: 'Creating documentation run.'
      });

      const run = await createRun();

      setRunState({
        status: 'uploading',
        runId: run.runId,
        message: 'Uploading source archives.'
      });

      await uploadSources(run.runId, sources);

      setRunState({
        status: 'running',
        runId: run.runId,
        message: 'Analyzing sources and generating documentation.'
      });

      await startRun(run.runId);
      const result = await getResult(run.runId);
      setRunState({
        status: 'completed',
        runId: run.runId,
        result,
        message: 'Documentation generated.'
      });
      setSelectedPageKey(result.documentation.pages[0]?.key ?? null);
    } catch (error) {
      setRunState({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Documentation generation failed.'
      });
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Codebase Docs AI</p>
          <h1>Documentation run</h1>
        </div>
        <button className="primary-action" type="button" onClick={generateDocumentation}>
          <Play size={18} />
          Generate
        </button>
      </header>

      <section className="workspace">
        <aside className="panel sources-panel">
          <label className="dropzone">
            <Upload size={24} />
            <span>Upload source archives</span>
            <input
              type="file"
              multiple
              accept=".zip,.tar,.gz,.tgz"
              onChange={(event) => addFiles(event.currentTarget.files)}
            />
          </label>

          <div className="source-list">
            {sources.map((source) => (
              <div className="source-row" key={source.id}>
                <FileArchive size={18} />
                <div className="source-fields">
                  <input
                    value={source.name}
                    aria-label="Source name"
                    onChange={(event) => updateSource(source.id, { name: event.target.value })}
                  />
                  <select
                    value={source.role}
                    aria-label="Source role"
                    onChange={(event) =>
                      updateSource(source.id, { role: event.target.value as SourceRole })
                    }
                  >
                    {sourceRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Remove ${source.name}`}
                  onClick={() => removeSource(source.id)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel result-panel">
          <div className="status-line" data-state={runState.status}>
            <span>{runState.message ?? 'Upload archives and start a documentation run.'}</span>
          </div>

          {runState.result ? (
            <div className="result-grid">
              <nav className="page-list" aria-label="Generated pages">
                {runState.result.documentation.pages.map((page) => (
                  <button
                    key={page.key}
                    className={page.key === selectedPageKey ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelectedPageKey(page.key)}
                  >
                    {page.title}
                  </button>
                ))}
              </nav>

              <article className="preview">
                <div className="download-row">
                  {outputFormats.map((format) => (
                    <button
                      key={format}
                      type="button"
                      className="secondary-action"
                      onClick={() => downloadResult(runState.runId, format)}
                    >
                      <Download size={16} />
                      {format}
                    </button>
                  ))}
                </div>
                <pre>{selectedPage?.markdown ?? 'Select a page to preview generated markdown.'}</pre>
              </article>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

type RunStatus = 'idle' | 'creating' | 'uploading' | 'running' | 'completed' | 'failed';

interface RunState {
  status: RunStatus;
  runId?: string;
  message?: string;
  result?: DocumentationRunResult;
}

interface DocumentationRunResult {
  runId: string;
  status: string;
  documentation: {
    pages: Array<{
      key: string;
      title: string;
      markdown: string;
    }>;
    warnings: Array<{
      level: string;
      message: string;
    }>;
  };
}

const sourceRoles: SourceRole[] = ['frontend', 'backend', 'shared', 'infra', 'mobile', 'docs', 'unknown'];
const outputFormats = ['markdown-tree', 'single-markdown', 'json'];
const apiBaseUrl = import.meta.env.WEB_API_BASE_URL ?? 'http://localhost:3000';

async function createRun(): Promise<{ runId: string; status: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Generated Project Documentation',
      options: {
        outputFormats,
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    })
  });

  return parseResponse(response);
}

async function uploadSources(runId: string, sources: SourceDraft[]): Promise<void> {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(buildSourceUploadMetadata(sources)));

  for (const source of sources) {
    formData.append(source.id, source.file);
  }

  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs/${runId}/sources`, {
    method: 'POST',
    body: formData
  });

  await parseResponse(response);
}

async function startRun(runId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs/${runId}/start`, {
    method: 'POST'
  });

  await parseResponse(response);
}

async function getResult(runId: string): Promise<DocumentationRunResult> {
  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs/${runId}/result`);
  return parseResponse(response);
}

function downloadResult(runId: string | undefined, format: string): void {
  if (!runId) {
    return;
  }

  window.open(`${apiBaseUrl}/v1/documentation-runs/${runId}/download?format=${format}`, '_blank');
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
