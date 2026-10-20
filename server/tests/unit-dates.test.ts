// Se fija la zona horaria antes de usar Date: BUG-18 (fecha de vencimiento
// desplazada) solo se manifiesta en zonas con offset negativo, y este archivo
// debe comportarse igual en cualquier mÃ¡quina.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { formatDueDate, parseDueDate, parsePublicId, toPublicId } from '../src/lib/ids';

describe('fechas de vencimiento (unit, TZ UTC-3)', () => {
  it('parseDueDate acepta YYYY-MM-DD y rechaza otros formatos (US-16 CA2/CA6)', () => {
    const parsed = parseDueDate('2030-05-19');
    expect(parsed).toBeInstanceOf(Date);
    expect(parseDueDate('15/09/2026')).toBeUndefined();
    expect(parseDueDate('tomorrow')).toBeUndefined();
    expect(parseDueDate('2030-5-9')).toBeUndefined();
  });

  it('parseDueDate distingue null (quitar fecha) de undefined (formato invÃ¡lido)', () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate(undefined)).toBeUndefined();
  });

  it('formatDueDate devuelve null cuando no hay fecha (US-16 CA4/CA5)', () => {
    expect(formatDueDate(null)).toBeNull();
  });

  // BUG-18: parseDueDate construye la fecha con new Date('YYYY-MM-DD')
  // (medianoche UTC) y formatDueDate formatea con hora local; en UTC-3 el
  // dÃ­a retrocede un dÃ­a. US-16 CA3 exige devolver siempre la misma fecha
  // que se cargÃ³, sin importar la zona horaria.
  it('el parseo y el formateo hacen roundtrip de la fecha (US-16 CA3)', () => {
    const parsed = parseDueDate('2030-05-19');
    expect(parsed).toBeInstanceOf(Date);
    expect(formatDueDate(parsed!)).toBe('2030-05-19');
  });
});

describe('identificadores pÃºblicos (unit)', () => {
  it('parsePublicId acepta el formato prefijado y rechaza basura', () => {
    expect(parsePublicId('task-7', 'task')).toBe(7);
    expect(parsePublicId('proj-7', 'task')).toBeNull();
    expect(parsePublicId('no-numÃ©rico')).toBeNull();
    expect(parsePublicId('')).toBeNull();
    expect(parsePublicId(42)).toBe(42);
  });

  it('toPublicId arma el identificador legible', () => {
    expect(toPublicId('user', 3)).toBe('user-3');
    expect(toPublicId('comment', 12)).toBe('comment-12');
  });
});
