import { describe, expect, it } from 'vitest';
import {
  getSupportedSourceArchiveExtension,
  isSupportedSourceArchiveFileName,
  stripSupportedSourceArchiveExtension,
  supportedSourceArchiveAccept,
  supportedSourceArchiveExtensions,
  supportedSourceArchiveLabel
} from './source-archive-contract.js';

describe('source archive contract', () => {
  it('publishes the supported source archive extensions', () => {
    expect(supportedSourceArchiveExtensions).toEqual(['.zip', '.tar', '.tar.gz', '.tgz']);
    expect(supportedSourceArchiveAccept).toBe('.zip,.tar,.tar.gz,.tgz');
    expect(supportedSourceArchiveLabel).toBe('Supports .zip, .tar, .tar.gz, .tgz');
  });

  it('detects supported archive file names case-insensitively', () => {
    expect(isSupportedSourceArchiveFileName('frontend.zip')).toBe(true);
    expect(isSupportedSourceArchiveFileName('backend.tar')).toBe(true);
    expect(isSupportedSourceArchiveFileName('shared.TAR.GZ')).toBe(true);
    expect(isSupportedSourceArchiveFileName('infra.tgz')).toBe(true);
    expect(isSupportedSourceArchiveFileName('docs.gz')).toBe(false);
  });

  it('returns the matched supported archive extension', () => {
    expect(getSupportedSourceArchiveExtension('frontend.zip')).toBe('.zip');
    expect(getSupportedSourceArchiveExtension('backend.TAR.GZ')).toBe('.tar.gz');
    expect(getSupportedSourceArchiveExtension('docs.gz')).toBeUndefined();
  });

  it('strips only supported archive extensions', () => {
    expect(stripSupportedSourceArchiveExtension('customer-portal_frontend.zip')).toBe(
      'customer-portal_frontend'
    );
    expect(stripSupportedSourceArchiveExtension('backend.TAR.GZ')).toBe('backend');
    expect(stripSupportedSourceArchiveExtension('docs.gz')).toBe('docs.gz');
  });
});
