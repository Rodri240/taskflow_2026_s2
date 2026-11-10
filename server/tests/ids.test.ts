import { formatDueDate, parseDueDate, parsePublicId, toPublicId } from '../src/lib/ids';

describe('ids', () => {
  describe('toPublicId', () => {
    it('genera el identificador con el prefijo indicado', () => {
      expect(toPublicId('user', 1)).toBe('user-1');
      expect(toPublicId('proj', 2)).toBe('proj-2');
      expect(toPublicId('task', 3)).toBe('task-3');
      expect(toPublicId('comment', 4)).toBe('comment-4');
      expect(toPublicId('tag', 5)).toBe('tag-5');
    });
  });

  describe('parsePublicId', () => {
    it('acepta números enteros', () => {
      expect(parsePublicId(7)).toBe(7);
    });

    it('acepta strings numéricos sin prefijo', () => {
      expect(parsePublicId('7')).toBe(7);
      expect(parsePublicId(' 7 ')).toBe(7);
    });

    it('acepta identificadores con prefijo', () => {
      expect(parsePublicId('user-12')).toBe(12);
      expect(parsePublicId('task-12', 'task')).toBe(12);
    });

    it('rechaza un prefijo distinto al esperado', () => {
      expect(parsePublicId('user-12', 'proj')).toBeNull();
    });

    it('rechaza valores vacíos o que no son texto', () => {
      expect(parsePublicId('')).toBeNull();
      expect(parsePublicId('   ')).toBeNull();
      expect(parsePublicId(null)).toBeNull();
      expect(parsePublicId(undefined)).toBeNull();
      expect(parsePublicId({})).toBeNull();
    });

    it('rechaza números no enteros', () => {
      expect(parsePublicId(1.5)).toBeNull();
      expect(parsePublicId('task-1.5')).toBeNull();
    });

    it('rechaza identificadores no positivos o no numéricos', () => {
      expect(parsePublicId('user-0')).toBeNull();
      expect(parsePublicId('task-abc')).toBeNull();
    });
  });

  describe('parseDueDate', () => {
    it('acepta null y lo devuelve como null', () => {
      expect(parseDueDate(null)).toBeNull();
    });

    it('rechaza valores que no son texto', () => {
      expect(parseDueDate(123)).toBeUndefined();
      expect(parseDueDate({})).toBeUndefined();
    });

    it('rechaza formatos que no son YYYY-MM-DD', () => {
      expect(parseDueDate('2024-3-1')).toBeUndefined();
      expect(parseDueDate('15/12/2026')).toBeUndefined();
      expect(parseDueDate('mañana')).toBeUndefined();
    });

    it('rechaza fechas de calendario inválidas', () => {
      expect(parseDueDate('2024-13-01')).toBeUndefined();
    });

    it('acepta una fecha válida', () => {
      const parsed = parseDueDate('2024-02-29');
      expect(parsed).toBeInstanceOf(Date);
      expect(Number.isNaN(parsed!.getTime())).toBe(false);
    });
  });

  describe('formatDueDate', () => {
    it('devuelve null cuando no hay fecha', () => {
      expect(formatDueDate(null)).toBeNull();
    });

    it('formatea con mes y día de dos dígitos', () => {
      expect(formatDueDate(new Date(2024, 0, 5))).toBe('2024-01-05');
      expect(formatDueDate(new Date(2024, 11, 31))).toBe('2024-12-31');
    });
  });
});
