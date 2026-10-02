import fs from 'fs';
import path from 'path';
import { renderWatchProgressXGeometry } from '../../scripts/watchProgressXGeometry.mjs';

const TARGETS = path.join(__dirname, '../../targets');
const read = (relative: string) =>
  fs.readFileSync(path.join(TARGETS, relative), 'utf8');

describe('watch Progress X complication', () => {
  it('draws the same X geometry as the phone and web', () => {
    for (const target of ['watch-widget', 'watch'])
      expect(read(`${target}/ProgressXGeometry.swift`)).toBe(
        renderWatchProgressXGeometry()
      );
    expect(read('watch/ProgressXDrawing.swift')).toBe(
      read('watch-widget/ProgressXDrawing.swift')
    );
    expect(read('watch-widget/ProgressXComplication.swift')).toContain(
      'ComplicationLink.progress.url'
    );
    expect(read('watch/Presentation/ContentView.swift')).toContain(
      'DailyGoalsView()'
    );
  });

  // Separate Swift modules share nothing but these strings; a rename on one
  // side leaves the complication silently empty.
  it('reads the storage key and kind the watch app publishes', () => {
    const publisher = read('watch/Infrastructure/ComplicationPublisher.swift');
    const widget = read('watch-widget/ProgressXComplication.swift');
    for (const wire of ['"dailyProgressSnapshot"', '"progressXComplication"']) {
      expect(publisher).toContain(wire);
      expect(widget).toContain(wire);
    }
    for (const field of ['completed', 'applicable', 'percent']) {
      expect(publisher).toMatch(new RegExp(`let ${field}: `));
      expect(widget).toMatch(new RegExp(`let ${field}: `));
    }
    expect(read('watch-widget/index.swift')).toContain(
      'ProgressXComplication()'
    );
  });

  it('parses the payload keys the phone sends', () => {
    const mapper = read('watch/Adapters/ContextPayloadMapper.swift');
    const payloadType = fs.readFileSync(
      path.join(__dirname, '../../modules/watch-connectivity/index.ts'),
      'utf8'
    );
    for (const key of [
      'dailyProgressCompleted',
      'dailyProgressApplicable',
      'dailyProgressPercent',
    ]) {
      expect(mapper).toContain(`payload["${key}"]`);
      expect(payloadType).toContain(`${key}?: number | null;`);
    }
  });
});
