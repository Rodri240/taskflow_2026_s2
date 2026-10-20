import {
  assertEmail,
  assertPassword,
  assertPriority,
  assertStatus,
  assertString,
  normalizeEmail,
} from '../src/lib/validation';
import { assertTransition } from '../src/modules/tasks/transitions';

describe('validaciÃ³n (unit)', () => {
  it('normalizeEmail recorta y pasa a minÃºsculas (US-01 CA2)', () => {
    expect(normalizeEmail('  Ana@Test.COM ')).toBe('ana@test.com');
  });

  it('assertEmail acepta un email vÃ¡lido y rechaza invÃ¡lidos (US-01 CA1)', () => {
    expect(assertEmail('ana@test.com')).toBe('ana@test.com');
    expect(assertEmail('ANA@TEST.COM')).toBe('ana@test.com');
    expect(() => assertEmail('no-es-email')).toThrow(/Email/);
    expect(() => assertEmail('ana@')).toThrow(/Email/);
    expect(() => assertEmail(123)).toThrow(/Email/);
  });

  it('assertPassword acepta una contraseÃ±a con mayÃºscula, nÃºmero y largo suficiente', () => {
    expect(assertPassword('Password1')).toBe('Password1');
  });

  it('assertPassword rechaza sin mayÃºscula, sin nÃºmero y muy corta', () => {
    expect(() => assertPassword('password1')).toThrow(/at least 8/);
    expect(() => assertPassword('Password')).toThrow(/at least 8/);
    expect(() => assertPassword('Abc123')).toThrow(/at least 8/);
    expect(() => assertPassword(12345678)).toThrow(/Password is required/);
  });

  // BUG-07: el mÃ­nimo implementado es 7 caracteres, no el mÃ­nimo 8 de
  // US-01 CA3; 'Abc1234' (7, con mayÃºscula y nÃºmero) hoy se acepta.
  it('assertPassword rechaza exactamente 7 caracteres (US-01 CA3)', () => {
    expect(() => assertPassword('Abc1234')).toThrow();
  });

  it('assertPriority solo admite LOW/MEDIUM/HIGH/CRITICAL (US-05 CA2)', () => {
    expect(assertPriority('CRITICAL')).toBe('CRITICAL');
    expect(() => assertPriority('URGENTE')).toThrow(/LOW, MEDIUM, HIGH, CRITICAL/);
    expect(() => assertPriority(1)).toThrow(/Priority/);
  });

  it('assertStatus solo admite TODO/IN_PROGRESS/DONE (US-06)', () => {
    expect(assertStatus('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(() => assertStatus('BOGUS')).toThrow(/TODO, IN_PROGRESS, DONE/);
  });

  it('assertString valida la longitud y recorta espacios (US-05 CA1)', () => {
    expect(assertString('  TÃ­tulo  ', 'title', 3, 200)).toBe('TÃ­tulo');
    expect(() => assertString('ab', 'title', 3, 200)).toThrow(/between 3 and 200/);
    expect(() => assertString(42, 'title', 3, 200)).toThrow(/title is required/);
  });
});

describe('transiciones de estado (unit)', () => {
  it('permite TODOâ†’IN_PROGRESS, IN_PROGRESSâ†’TODO, IN_PROGRESSâ†’DONE y el mismo estado (US-06 CA1)', () => {
    expect(() => assertTransition('TODO', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'TODO')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'DONE')).not.toThrow();
    expect(() => assertTransition('DONE', 'DONE')).not.toThrow();
  });

  it('bloquea salir de DONE hacia cualquier estado (US-06 CA3)', () => {
    expect(() => assertTransition('DONE', 'TODO')).toThrow(/Cannot move/);
    expect(() => assertTransition('DONE', 'IN_PROGRESS')).toThrow(/Cannot move/);
  });

  // BUG-10: la lista de bloqueos no incluye TODOâ†’DONE; US-06 CA2 prohÃ­be
  // ir de TODO directamente a DONE.
  it('bloquea la transiciÃ³n directa TODOâ†’DONE (US-06 CA2)', () => {
    expect(() => assertTransition('TODO', 'DONE')).toThrow(/Cannot move/);
  });
});
