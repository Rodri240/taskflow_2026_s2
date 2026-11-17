import { ApiError } from '../src/lib/http';
import {
  assertEmail,
  assertOptionalString,
  assertPassword,
  assertPriority,
  assertStatus,
  assertString,
  normalizeEmail,
} from '../src/lib/validation';

function expectBadRequest(fn: () => unknown): void {
  expect(fn).toThrow(ApiError);
  try {
    fn();
  } catch (err) {
    expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    expect((err as ApiError).status).toBe(400);
  }
}

describe('validation', () => {
  describe('normalizeEmail', () => {
    it('recorta y pasa a minúsculas', () => {
      expect(normalizeEmail('  Ana@TEST.com ')).toBe('ana@test.com');
    });
  });

  describe('assertEmail', () => {
    it('acepta y normaliza un email válido', () => {
      expect(assertEmail('  Ana@TEST.com ')).toBe('ana@test.com');
    });

    it('rechaza emails inválidos', () => {
      expectBadRequest(() => assertEmail('no-es-un-email'));
      expectBadRequest(() => assertEmail('a@b'));
      expectBadRequest(() => assertEmail(123));
    });
  });

  describe('assertPassword', () => {
    it('acepta una contraseña válida', () => {
      expect(assertPassword('Password1')).toBe('Password1');
    });

    it('rechaza una contraseña que no es texto', () => {
      expectBadRequest(() => assertPassword(123));
    });

    it('rechaza contraseñas sin número o sin mayúscula', () => {
      expectBadRequest(() => assertPassword('Password'));
      expectBadRequest(() => assertPassword('password1'));
    });

    it('rechaza contraseñas demasiado cortas', () => {
      expectBadRequest(() => assertPassword('Abc123'));
    });
  });

  describe('assertString', () => {
    it('recorta y acepta un texto dentro del rango', () => {
      expect(assertString('  hola  ', 'title', 3, 10)).toBe('hola');
    });

    it('rechaza textos fuera del rango', () => {
      expectBadRequest(() => assertString('ab', 'title', 3, 10));
      expectBadRequest(() => assertString('x'.repeat(11), 'title', 3, 10));
    });

    it('rechaza valores que no son texto', () => {
      expectBadRequest(() => assertString(123, 'title', 3, 10));
    });
  });

  describe('assertOptionalString', () => {
    it('devuelve undefined cuando el valor no viene', () => {
      expect(assertOptionalString(undefined, 'description', 10)).toBeUndefined();
    });

    it('devuelve null cuando el valor es null', () => {
      expect(assertOptionalString(null, 'description', 10)).toBeNull();
    });

    it('recorta un texto válido', () => {
      expect(assertOptionalString('  texto  ', 'description', 10)).toBe('texto');
    });

    it('rechaza textos demasiado largos', () => {
      expectBadRequest(() => assertOptionalString('x'.repeat(11), 'description', 10));
    });

    it('rechaza valores que no son texto', () => {
      expectBadRequest(() => assertOptionalString(123, 'description', 10));
    });
  });

  describe('assertPriority', () => {
    it('acepta una prioridad válida', () => {
      expect(assertPriority('HIGH')).toBe('HIGH');
    });

    it('rechaza prioridades inválidas', () => {
      expectBadRequest(() => assertPriority('URGENT'));
      expectBadRequest(() => assertPriority(1));
    });
  });

  describe('assertStatus', () => {
    it('acepta un estado válido', () => {
      expect(assertStatus('DONE')).toBe('DONE');
    });

    it('rechaza estados inválidos', () => {
      expectBadRequest(() => assertStatus('done'));
      expectBadRequest(() => assertStatus(null));
    });
  });
});
