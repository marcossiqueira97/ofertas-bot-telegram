import { describe, it, expect } from 'vitest';
import { parseIngestOptions } from './ingest-real-offer';

describe('Ingest Real Offer Options & Safety Parsing', () => {
  it('should default to DRY_RUN mode when --publish flag is absent', () => {
    const options = parseIngestOptions(['node', 'script.js']);
    expect(options.isPublishMode).toBe(false);
    expect(options.mode).toBe('DRY_RUN');
  });

  it('should enable PUBLISH mode only when --publish flag is explicitly passed', () => {
    const options = parseIngestOptions(['node', 'script.js', '--publish']);
    expect(options.isPublishMode).toBe(true);
    expect(options.mode).toBe('PUBLISH');
  });

  it('should remain in DRY_RUN mode when other random flags are passed', () => {
    const options = parseIngestOptions(['node', 'script.js', '--verbose', '--dry-run']);
    expect(options.isPublishMode).toBe(false);
    expect(options.mode).toBe('DRY_RUN');
  });
});
