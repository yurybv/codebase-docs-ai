import React from 'react';
import ReactDOM from 'react-dom/client';
import { defaultDocumentationRunListLimit } from '@codebase-docs-ai/shared';
import type { DocumentationRunStatus } from '@codebase-docs-ai/shared';
import { AlertTriangle, Download, FileArchive, Play, RefreshCw, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import './styles.css';
import { formatApiErrorMessage, parseApiError, sanitizeWebErrorText } from './api-errors.js';
import {
  buildSourceUploadMetadata,
  inferSourceName,
  type SourceDraft,
  type SourceRole
} from './source-metadata.js';
import {
  formatBytes,
  supportedArchiveAccept,
  supportedArchiveLabel,
  uploadConstraintsFromEnv,
  validateSelectedFiles
} from './upload-constraints.js';

const uploadConstraints = uploadConstraintsFromEnv(import.meta.env);

export function App(): JSX.Element {
  const [sources, setSources] = useState<SourceDraft[]>([]);
  const [selectedOutputFormats, setSelectedOutputFormats] =
    useState<DocumentationOutputFormat[]>(defaultOutputFormats);
  const [selectedPageKey, setSelectedPageKey] = useState<string | null>(null);
  const [runHistoryLimit, setRunHistoryLimit] = useState(defaultDocumentationRunListLimit);
  const [runHistoryStatus, setRunHistoryStatus] = useState<RunHistoryStatusFilter>('all');
  const [runHistoryRole, setRunHistoryRole] = useState<RunHistoryRoleFilter>('all');
  const [runHistoryName, setRunHistoryName] = useState('');
  const [runHistoryFormat, setRunHistoryFormat] = useState<RunHistoryFormatFilter>('all');
  const [runHistoryMinSources, setRunHistoryMinSources] = useState('');
  const [runHistoryMaxSources, setRunHistoryMaxSources] = useState('');
  const [runHistorySort, setRunHistorySort] = useState<RunHistorySort>('updatedAt:desc');
  const [runHistoryCreatedAfter, setRunHistoryCreatedAfter] = useState('');
  const [runHistoryCreatedBefore, setRunHistoryCreatedBefore] = useState('');
  const [runHistoryCompletedAfter, setRunHistoryCompletedAfter] = useState('');
  const [runHistoryCompletedBefore, setRunHistoryCompletedBefore] = useState('');
  const [runHistoryUpdatedAfter, setRunHistoryUpdatedAfter] = useState('');
  const [runHistoryUpdatedBefore, setRunHistoryUpdatedBefore] = useState('');
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [runHistoryNextCursor, setRunHistoryNextCursor] = useState<string | undefined>();
  const [runHistoryState, setRunHistoryState] = useState<RunHistoryState>({
    status: 'idle'
  });
  const [runState, setRunState] = useState<RunState>({
    status: 'idle'
  });

  const selectedPage = useMemo(() => {
    return runState.result?.documentation.pages.find((page) => page.key === selectedPageKey) ?? null;
  }, [runState.result, selectedPageKey]);
  const generationInProgress =
    runState.status === 'creating' || runState.status === 'uploading' || runState.status === 'running';
  const downloadFormats = runState.outputFormats ?? selectedOutputFormats;

  function addFiles(fileList: FileList | null): void {
    if (!fileList) {
      return;
    }

    const selectedFiles = Array.from(fileList);
    const validation = validateSelectedFiles(sources.length, selectedFiles, uploadConstraints);
    if (validation.errorMessage) {
      setRunState({
        status: 'failed',
        message: validation.errorMessage
      });
      return;
    }

    const newSources = validation.acceptedFiles.map((file, index) => ({
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

  function toggleOutputFormat(format: DocumentationOutputFormat): void {
    setSelectedOutputFormats((currentFormats) =>
      currentFormats.includes(format)
        ? currentFormats.filter((currentFormat) => currentFormat !== format)
        : [...currentFormats, format]
    );
  }

  function resetRunHistoryPagination(): void {
    setRunHistory([]);
    setRunHistoryNextCursor(undefined);
    setRunHistoryState({
      status: 'idle'
    });
  }

  async function refreshRunHistory(): Promise<void> {
    await loadRunHistoryPage();
  }

  async function loadMoreRunHistory(): Promise<void> {
    if (!runHistoryNextCursor) {
      return;
    }

    await loadRunHistoryPage(runHistoryNextCursor);
  }

  async function loadRunHistoryPage(cursor?: string): Promise<void> {
    if (runHistoryState.status === 'loading') {
      return;
    }

    try {
      setRunHistoryState({
        status: 'loading'
      });
      const list = await listRuns(
        runHistoryLimit,
        runHistoryStatus,
        runHistoryRole,
        runHistoryName,
        runHistoryFormat,
        runHistoryMinSources,
        runHistoryMaxSources,
        runHistorySort,
        runHistoryCreatedAfter,
        runHistoryCreatedBefore,
        runHistoryCompletedAfter,
        runHistoryCompletedBefore,
        runHistoryUpdatedAfter,
        runHistoryUpdatedBefore,
        cursor
      );
      const sanitizedRuns = sanitizeRunSummaries(list.runs);
      setRunHistory((currentRuns) => (cursor ? [...currentRuns, ...sanitizedRuns] : sanitizedRuns));
      setRunHistoryNextCursor(
        list.nextCursor ? sanitizeWebErrorText(list.nextCursor, '[REDACTED]') : undefined
      );
      setRunHistoryState({
        status: 'loaded'
      });
    } catch (error) {
      setRunHistoryState({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Run history unavailable.'
      });
    }
  }

  async function generateDocumentation(): Promise<void> {
    let activeRunId: string | undefined;
    if (generationInProgress) {
      return;
    }

    if (sources.length === 0) {
      setRunState({
        status: 'failed',
        message: 'Upload at least one archive before generating documentation.'
      });
      return;
    }

    if (selectedOutputFormats.length === 0) {
      setRunState({
        status: 'failed',
        message: 'Select at least one output format before generating documentation.'
      });
      return;
    }

    const runOutputFormats = selectedOutputFormats;

    try {
      setRunState({
        status: 'creating',
        message: 'Creating documentation run.',
        outputFormats: runOutputFormats
      });

      const run = await createRun(runOutputFormats);
      activeRunId = run.runId;

      setRunState({
        status: 'uploading',
        runId: run.runId,
        message: 'Uploading source archives.',
        outputFormats: runOutputFormats
      });

      await uploadSources(run.runId, sources);

      setRunState({
        status: 'running',
        runId: run.runId,
        message: 'Analyzing sources and generating documentation.',
        outputFormats: runOutputFormats
      });

      await startRun(run.runId);
      const runDetails = await getRun(run.runId);
      const result = await getResult(run.runId);
      const renderedFormats = result.renderedFormats ?? runDetails.renderedFormats ?? runOutputFormats;
      setRunState({
        status: 'completed',
        runId: run.runId,
        ...(runDetails.progress ? { progress: runDetails.progress } : {}),
        result,
        outputFormats: renderedFormats,
        message: 'Documentation generated.'
      });
      setSelectedPageKey(result.documentation.pages[0]?.key ?? null);
    } catch (error) {
      const details = await failedRunDetails(activeRunId);
      setRunState({
        status: 'failed',
        ...(activeRunId ? { runId: activeRunId } : {}),
        ...details,
        outputFormats: runOutputFormats,
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
        <button
          className="primary-action"
          type="button"
          onClick={generateDocumentation}
          disabled={generationInProgress}
          aria-label={generationInProgress ? 'Documentation generation in progress' : 'Generate documentation'}
        >
          <Play size={18} />
          Generate
        </button>
      </header>

      <section className="workspace">
        <aside className="panel sources-panel">
          <label className="dropzone">
            <Upload size={24} />
            <span>Upload source archives</span>
            <small>{supportedArchiveLabel}</small>
            <small>
              {uploadConstraints.maxFiles} files max, {formatBytes(uploadConstraints.maxFileSizeBytes)} each
            </small>
            <input
              type="file"
              multiple
              accept={supportedArchiveAccept}
              aria-label="Upload source archives"
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

          <fieldset className="format-fieldset" disabled={generationInProgress}>
            <legend>Output formats</legend>
            <div className="format-options">
              {outputFormatOptions.map((format) => (
                <label className="format-option" key={format}>
                  <input
                    type="checkbox"
                    checked={selectedOutputFormats.includes(format)}
                    aria-label={`Include ${format} output`}
                    onChange={() => toggleOutputFormat(format)}
                  />
                  <span>{format}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="run-history" aria-label="Recent documentation runs">
            <div className="run-history-heading">
              <span>Recent runs</span>
              <div className="run-history-controls">
                <label className="history-limit">
                  <span>Limit</span>
                  <select
                    value={runHistoryLimit}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run limit"
                    onChange={(event) => {
                      setRunHistoryLimit(Number(event.currentTarget.value));
                      resetRunHistoryPagination();
                    }}
                  >
                    {runHistoryLimitOptions.map((limit) => (
                      <option value={limit} key={limit}>
                        {limit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-limit">
                  <span>Status</span>
                  <select
                    value={runHistoryStatus}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run status"
                    onChange={(event) => {
                      setRunHistoryStatus(event.currentTarget.value as RunHistoryStatusFilter);
                      resetRunHistoryPagination();
                    }}
                  >
                    <option value="all">All</option>
                    {runHistoryStatusOptions.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-limit">
                  <span>Role</span>
                  <select
                    value={runHistoryRole}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run source role"
                    onChange={(event) => {
                      setRunHistoryRole(event.currentTarget.value as RunHistoryRoleFilter);
                      resetRunHistoryPagination();
                    }}
                  >
                    <option value="all">All</option>
                    {sourceRoles.map((role) => (
                      <option value={role} key={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-limit">
                  <span>Name</span>
                  <input
                    value={runHistoryName}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run name"
                    onChange={(event) => {
                      setRunHistoryName(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Format</span>
                  <select
                    value={runHistoryFormat}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run output format"
                    onChange={(event) => {
                      setRunHistoryFormat(event.currentTarget.value as RunHistoryFormatFilter);
                      resetRunHistoryPagination();
                    }}
                  >
                    <option value="all">All</option>
                    {outputFormatOptions.map((format) => (
                      <option value={format} key={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-limit">
                  <span>Min sources</span>
                  <input
                    value={runHistoryMinSources}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run minimum sources"
                    onChange={(event) => {
                      setRunHistoryMinSources(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Max sources</span>
                  <input
                    value={runHistoryMaxSources}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run maximum sources"
                    onChange={(event) => {
                      setRunHistoryMaxSources(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Sort</span>
                  <select
                    value={runHistorySort}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run sort"
                    onChange={(event) => {
                      setRunHistorySort(event.currentTarget.value as RunHistorySort);
                      resetRunHistoryPagination();
                    }}
                  >
                    {runHistorySortOptions.map((sort) => (
                      <option value={sort} key={sort}>
                        {sort}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-limit">
                  <span>Created after</span>
                  <input
                    value={runHistoryCreatedAfter}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run created after"
                    onChange={(event) => {
                      setRunHistoryCreatedAfter(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Created before</span>
                  <input
                    value={runHistoryCreatedBefore}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run created before"
                    onChange={(event) => {
                      setRunHistoryCreatedBefore(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Completed after</span>
                  <input
                    value={runHistoryCompletedAfter}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run completed after"
                    onChange={(event) => {
                      setRunHistoryCompletedAfter(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Completed before</span>
                  <input
                    value={runHistoryCompletedBefore}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run completed before"
                    onChange={(event) => {
                      setRunHistoryCompletedBefore(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Updated after</span>
                  <input
                    value={runHistoryUpdatedAfter}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run updated after"
                    onChange={(event) => {
                      setRunHistoryUpdatedAfter(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <label className="history-limit">
                  <span>Updated before</span>
                  <input
                    value={runHistoryUpdatedBefore}
                    disabled={runHistoryState.status === 'loading'}
                    aria-label="Recent run updated before"
                    onChange={(event) => {
                      setRunHistoryUpdatedBefore(event.currentTarget.value);
                      resetRunHistoryPagination();
                    }}
                  />
                </label>
                <button
                  className="secondary-action history-refresh"
                  type="button"
                  onClick={refreshRunHistory}
                  disabled={runHistoryState.status === 'loading'}
                  aria-label="Refresh recent documentation runs"
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>
            </div>
            {runHistoryState.status === 'failed' ? (
              <p className="history-error" role="alert">
                {sanitizeWebErrorText(runHistoryState.message ?? '', 'Run history unavailable.')}
              </p>
            ) : null}
            {runHistory.length > 0 ? (
              <ul className="run-history-list">
                {runHistory.map((run) => (
                  <li key={run.id}>
                    <div>
                      <span className="run-name">{run.name}</span>
                      <span className="run-meta">
                        {run.status} · {run.sourceCount} source{run.sourceCount === 1 ? '' : 's'}
                        {formatRunDuration(run.durationMs)
                          ? ` · duration ${formatRunDuration(run.durationMs)}`
                          : ''}
                      </span>
                    </div>
                    {run.renderedFormats && run.renderedFormats.length > 0 ? (
                      <span className="run-formats">{run.renderedFormats.join(', ')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="history-empty">
                {runHistoryState.status === 'loading' ? 'Loading runs.' : 'No runs loaded.'}
              </p>
            )}
            {runHistoryNextCursor ? (
              <button
                className="secondary-action history-load-more"
                type="button"
                onClick={loadMoreRunHistory}
                disabled={runHistoryState.status === 'loading'}
                aria-label="Load more recent documentation runs"
              >
                <RefreshCw size={15} />
                Load more
              </button>
            ) : null}
          </section>
        </aside>

        <section className="panel result-panel">
          <div
            className="status-line"
            data-state={runState.status}
            role="status"
            aria-live="polite"
          >
            <div className="status-copy">
              <span>{runState.message ?? 'Upload archives and start a documentation run.'}</span>
              {runState.progress ? (
                <span className="progress-label">
                  {runState.progress.currentStep} ({runState.progress.completedSteps}/
                  {runState.progress.totalSteps})
                </span>
              ) : null}
              {runState.error ? (
                <span className="error-detail" role="alert">
                  {sanitizeWebErrorText(runState.error.message, 'Documentation generation failed.')}
                </span>
              ) : null}
            </div>
            {runState.progress ? (
              <progress
                max={runState.progress.totalSteps}
                value={runState.progress.completedSteps}
                aria-label="Documentation run progress"
                aria-valuetext={`${runState.progress.currentStep}: ${runState.progress.completedSteps} of ${runState.progress.totalSteps}`}
              />
            ) : null}
          </div>

          {runState.result ? (
            <>
              {runState.result.documentation.warnings.length > 0 ? (
                <section
                  className="warning-panel"
                  role="region"
                  aria-label="Generated documentation warnings"
                >
                  <div className="warning-heading">
                    <AlertTriangle size={16} />
                    <span>Warnings</span>
                  </div>
                  <ul>
                    {runState.result.documentation.warnings.map((warning, index) => (
                      <li key={`${warning.level}_${index}`}>
                        <span>{warning.level}</span>
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

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
                    {downloadFormats.map((format) => (
                      <button
                        key={format}
                        type="button"
                        className="secondary-action"
                        aria-label={`Download ${format} documentation`}
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
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

type RunStatus = 'idle' | 'creating' | 'uploading' | 'running' | 'completed' | 'failed';
type RunHistoryStatus = 'idle' | 'loading' | 'loaded' | 'failed';

interface RunHistoryState {
  status: RunHistoryStatus;
  message?: string;
}

interface RunState {
  status: RunStatus;
  runId?: string;
  message?: string;
  progress?: DocumentationRunProgress;
  error?: DocumentationRunError;
  result?: DocumentationRunResult;
  outputFormats?: DocumentationOutputFormat[];
}

interface DocumentationRun {
  id: string;
  status: string;
  renderedFormats?: DocumentationOutputFormat[];
  progress?: DocumentationRunProgress;
  error?: DocumentationRunError;
}

interface DocumentationRunProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
}

interface DocumentationRunError {
  message: string;
}

interface DocumentationRunResult {
  runId: string;
  status: string;
  renderedFormats?: DocumentationOutputFormat[];
  documentation: {
    pages: Array<{
      key: string;
      title: string;
      markdown: string;
    }>;
    warnings: Array<{
      level: string;
      message: string;
      sourceReferences?: Array<{
        sourceName: string;
        path: string;
        line?: number;
      }>;
    }>;
  };
}

interface RunSummary {
  id: string;
  name: string;
  status: string;
  sourceCount: number;
  sources: Array<{
    id?: string;
    name: string;
    role: SourceRole;
  }>;
  outputFormats: DocumentationOutputFormat[];
  renderedFormats?: DocumentationOutputFormat[];
  progress?: DocumentationRunProgress;
  error?: DocumentationRunError;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
}

interface RunListResponse {
  runs: RunSummary[];
  nextCursor?: string;
}

const sourceRoles: SourceRole[] = ['frontend', 'backend', 'shared', 'infra', 'mobile', 'docs', 'unknown'];
type DocumentationOutputFormat = 'markdown-tree' | 'single-markdown' | 'json';
type RunHistoryStatusFilter = DocumentationRunStatus | 'all';
type RunHistoryRoleFilter = SourceRole | 'all';
type RunHistoryFormatFilter = DocumentationOutputFormat | 'all';
type RunHistorySort =
  | 'updatedAt:desc'
  | 'updatedAt:asc'
  | 'createdAt:desc'
  | 'createdAt:asc'
  | 'completedAt:desc'
  | 'completedAt:asc'
  | 'durationMs:desc'
  | 'durationMs:asc';
const outputFormatOptions: DocumentationOutputFormat[] = ['markdown-tree', 'single-markdown', 'json'];
const defaultOutputFormats: DocumentationOutputFormat[] = [...outputFormatOptions];
const runHistoryLimitOptions = [10, 25, defaultDocumentationRunListLimit, 100];
const runHistorySortOptions: RunHistorySort[] = [
  'updatedAt:desc',
  'updatedAt:asc',
  'createdAt:desc',
  'createdAt:asc',
  'completedAt:desc',
  'completedAt:asc',
  'durationMs:desc',
  'durationMs:asc'
];
const runHistoryStatusOptions: DocumentationRunStatus[] = [
  'created',
  'ready',
  'running',
  'completed',
  'failed',
  'cancelled',
  'expired'
];
const apiBaseUrl =
  import.meta.env.VITE_WEB_API_BASE_URL ?? import.meta.env.WEB_API_BASE_URL ?? 'http://localhost:3000';

async function createRun(outputFormats: DocumentationOutputFormat[]): Promise<{ runId: string; status: string }> {
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

async function listRuns(
  limit: number,
  status: RunHistoryStatusFilter,
  role: RunHistoryRoleFilter,
  name: string,
  format: RunHistoryFormatFilter,
  minSources: string,
  maxSources: string,
  sort: RunHistorySort,
  createdAfter: string,
  createdBefore: string,
  completedAfter: string,
  completedBefore: string,
  updatedAfter: string,
  updatedBefore: string,
  cursor?: string
): Promise<RunListResponse> {
  const query = new URLSearchParams({
    limit: String(limit)
  });
  if (status !== 'all') {
    query.set('status', status);
  }
  if (role !== 'all') {
    query.set('role', role);
  }
  const nameFilter = name.trim();
  const minSourcesFilter = minSources.trim();
  const maxSourcesFilter = maxSources.trim();
  const createdAfterFilter = createdAfter.trim();
  const createdBeforeFilter = createdBefore.trim();
  const completedAfterFilter = completedAfter.trim();
  const completedBeforeFilter = completedBefore.trim();
  const updatedAfterFilter = updatedAfter.trim();
  const updatedBeforeFilter = updatedBefore.trim();
  if (nameFilter) {
    query.set('name', nameFilter);
  }
  if (format !== 'all') {
    query.set('format', format);
  }
  if (minSourcesFilter) {
    query.set('minSources', minSourcesFilter);
  }
  if (maxSourcesFilter) {
    query.set('maxSources', maxSourcesFilter);
  }
  if (sort !== 'updatedAt:desc') {
    query.set('sort', sort);
  }
  if (createdAfterFilter) {
    query.set('createdAfter', createdAfterFilter);
  }
  if (createdBeforeFilter) {
    query.set('createdBefore', createdBeforeFilter);
  }
  if (completedAfterFilter) {
    query.set('completedAfter', completedAfterFilter);
  }
  if (completedBeforeFilter) {
    query.set('completedBefore', completedBeforeFilter);
  }
  if (updatedAfterFilter) {
    query.set('updatedAfter', updatedAfterFilter);
  }
  if (updatedBeforeFilter) {
    query.set('updatedBefore', updatedBeforeFilter);
  }
  if (cursor) {
    query.set('cursor', cursor);
  }
  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs?${query}`);
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

async function getRun(runId: string): Promise<DocumentationRun> {
  const response = await fetch(`${apiBaseUrl}/v1/documentation-runs/${runId}`);
  return parseResponse(response);
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
    const error = await parseApiError(response);
    throw new Error(formatApiErrorMessage(error, `Request failed with status ${response.status}`));
  }

  return response.json() as Promise<T>;
}

async function failedRunDetails(runId: string | undefined): Promise<Pick<RunState, 'progress' | 'error'>> {
  if (!runId) {
    return {};
  }

  try {
    const run = await getRun(runId);
    return {
      ...(run.progress ? { progress: run.progress } : {}),
      ...(run.error
        ? {
            error: {
              ...run.error,
              message: sanitizeWebErrorText(run.error.message, 'Documentation generation failed.')
            }
          }
        : {})
    };
  } catch {
    return {};
  }
}

function sanitizeRunSummaries(runs: RunSummary[]): RunSummary[] {
  return runs.map((run) => ({
    ...run,
    id: sanitizeWebErrorText(run.id, '[REDACTED]'),
    name: sanitizeWebErrorText(run.name, '[REDACTED]'),
    sources: run.sources.map((source) => ({
      ...(source.id ? { id: sanitizeWebErrorText(source.id, '[REDACTED]') } : {}),
      name: sanitizeWebErrorText(source.name, '[REDACTED]'),
      role: source.role
    })),
    ...(run.progress
      ? {
          progress: {
            ...run.progress,
            currentStep: sanitizeWebErrorText(run.progress.currentStep, '[REDACTED]')
          }
        }
      : {}),
    ...(run.error
      ? {
          error: {
            ...run.error,
            message: sanitizeWebErrorText(run.error.message, 'Documentation generation failed.')
          }
        }
      : {})
  }));
}

function formatRunDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return undefined;
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
