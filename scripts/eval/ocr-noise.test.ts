import { addOcrNoise, seededRandom } from './ocr-noise';

const TEXT =
  'Bitte überweisen Sie den offenen Betrag bis zum 20.10.2026 auf das unten genannte Konto. '.repeat(
    20,
  );

describe('addOcrNoise', () => {
  it('is deterministic for the same seed and differs between seeds', () => {
    expect(addOcrNoise(TEXT, 'medium', 1)).toBe(addOcrNoise(TEXT, 'medium', 1));
    expect(addOcrNoise(TEXT, 'medium', 1)).not.toBe(addOcrNoise(TEXT, 'medium', 2));
  });

  it('changes more of the text at higher levels', () => {
    const changed = (level: 'low' | 'medium' | 'high') => {
      const noisy = addOcrNoise(TEXT, level, 7);
      let diff = Math.abs(noisy.length - TEXT.length);
      for (let i = 0; i < Math.min(noisy.length, TEXT.length); i++) {
        if (noisy[i] !== TEXT[i]) diff++;
      }
      return diff;
    };
    expect(changed('low')).toBeLessThan(changed('medium'));
    expect(changed('medium')).toBeLessThan(changed('high'));
  });

  it('keeps the text recognisable', () => {
    const noisy = addOcrNoise(TEXT, 'high', 3);
    expect(Math.abs(noisy.length - TEXT.length) / TEXT.length).toBeLessThan(0.1);
  });
});

describe('seededRandom', () => {
  it('returns repeatable values in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
