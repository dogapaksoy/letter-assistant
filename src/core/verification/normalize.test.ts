import { normalizeForMatching } from './normalize';

const norm = (input: string) => normalizeForMatching(input).text;

describe('normalizeForMatching', () => {
  it('collapses whitespace and line breaks and trims', () => {
    expect(norm('  Bitte\n\n zahlen\tSie bis  ')).toBe('bitte zahlen sie bis');
  });

  it('lowercases and folds quote and dash styles', () => {
    expect(norm('„Zahlung“ – »Frist« ‚x‘')).toBe('"zahlung" - "frist" "x"');
  });

  it('folds German and Turkish special characters', () => {
    expect(norm('Straße Größe Ausländerbehörde')).toBe('strasse grosse auslanderbehorde');
    expect(norm('Ayşe Örnekoğlu Yılmaz İstanbul')).toBe('ayse ornekoglu yilmaz istanbul');
  });

  it('joins words hyphenated across a line break', () => {
    expect(norm('Aufenthalts-\ntitel')).toBe('aufenthaltstitel');
    expect(norm('Aufenthalts- \r\n  titel')).toBe('aufenthaltstitel');
  });

  it('keeps the hyphen of a real compound split across lines', () => {
    expect(norm('Yılmaz-\nDeneme')).toBe('yilmaz-deneme');
  });

  it('keeps hyphens that are not at a line break', () => {
    expect(norm('Mo-Fr, 8-18 Uhr')).toBe('mo-fr, 8-18 uhr');
  });

  it('removes soft hyphens and zero-width characters', () => {
    expect(norm('Immatri­kulations​bescheinigung')).toBe('immatrikulationsbescheinigung');
  });

  it('maps every normalized character back to its original index', () => {
    const input = ' A  ß\nb';
    const { text, sourceIndex } = normalizeForMatching(input);
    expect(text).toBe('a ss b');
    expect(sourceIndex).toEqual([1, 2, 4, 4, 5, 6]);
  });

  it('returns empty text for whitespace-only input', () => {
    expect(normalizeForMatching(' \n\t ')).toEqual({ text: '', sourceIndex: [] });
  });
});
