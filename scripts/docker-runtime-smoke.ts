import { spawn } from 'node:child_process';

const projectName = 'codebase-docs-ai-smoke';
const apiBaseUrl = 'http://localhost:3000';
const webBaseUrl = 'http://localhost:5173';

async function main(): Promise<void> {
  try {
    await runCommand('docker', ['compose', '-p', projectName, 'up', '-d', '--build']);
    await waitForHttp(`${apiBaseUrl}/health`);
    await waitForHttp(webBaseUrl);

    const webHtml = await fetchText(webBaseUrl);
    assert(webHtml.includes('root'), 'Web container root did not render.');

    console.log(
      JSON.stringify(
        {
          status: 'completed',
          apiBaseUrl,
          webBaseUrl
        },
        null,
        2
      )
    );
  } finally {
    await runCommand('docker', ['compose', '-p', projectName, 'down', '-v', '--remove-orphans'], {
      allowFailure: true
    });
  }
}

async function waitForHttp(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(500);
      continue;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }

  return response.text();
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    allowFailure?: boolean;
  } = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: 'inherit'
    });
    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      if (code === 0 || options.allowFailure) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with ${code}.`));
      }
    });
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main();
