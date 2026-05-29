import AdmZip from 'adm-zip';
import type { RenderedDocumentation } from '@codebase-docs-ai/shared';

export function renderZip(renderedDocumentation: RenderedDocumentation): Buffer {
  const zip = new AdmZip();

  for (const file of renderedDocumentation.files) {
    zip.addFile(file.path, Buffer.from(file.content, 'utf8'));
  }

  return zip.toBuffer();
}
