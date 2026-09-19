import { getCycleRule } from '../../../src/constants/academicCycle.js';

describe('academicCycle', () => {
  describe('getCycleRule', () => {
    test('UNIVERSITY: hasta 14 ciclos con default 10', () => {
      const rule = getCycleRule('UNIVERSITY');
      expect(rule.min).toBe(1);
      expect(rule.max).toBe(14);
      expect(rule.default).toBe(10);
    });

    test('INSTITUTE: solo 6 ciclos con default 6', () => {
      const rule = getCycleRule('INSTITUTE');
      expect(rule.min).toBe(1);
      expect(rule.max).toBe(6);
      expect(rule.default).toBe(6);
    });

    test('tipos desconocidos usan el fallback genérico', () => {
      const fallback = getCycleRule(undefined);
      const school = getCycleRule('SCHOOL');
      expect(fallback.max).toBe(14);
      expect(school).toEqual(fallback);
    });
  });
});