export const supportedSourceArchiveExtensions = ['.zip', '.tar', '.tar.gz', '.tgz'] as const;

export type SupportedSourceArchiveExtension = (typeof supportedSourceArchiveExtensions)[number];

export const supportedSourceArchiveAccept = supportedSourceArchiveExtensions.join(',');

export const supportedSourceArchiveLabel = `Supports ${supportedSourceArchiveExtensions.join(', ')}`;

export function getSupportedSourceArchiveExtension(
  fileName: string
): SupportedSourceArchiveExtension | undefined {
  const lowerFileName = fileName.toLowerCase();
  return supportedSourceArchiveExtensions.find((extension) => lowerFileName.endsWith(extension));
}

export function isSupportedSourceArchiveFileName(fileName: string): boolean {
  return getSupportedSourceArchiveExtension(fileName) !== undefined;
}

export function stripSupportedSourceArchiveExtension(fileName: string): string {
  const extension = getSupportedSourceArchiveExtension(fileName);
  if (!extension) {
    return fileName;
  }

  return fileName.slice(0, -extension.length);
}
