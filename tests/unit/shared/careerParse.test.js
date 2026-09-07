import { matchCareerFromCode, extractCycleFromCode } from '../../../src/shared/utils/careerParse.js';

describe('careerParse util', () => {
  const careers = [
    { id: 'c1', code: 'C', name: 'Computación', cycle: null },
    { id: 'c2', code: 'DDS', name: 'Diseño y Desarrollo de Software', cycle: null },
    { id: 'c3', code: 'ADM', name: 'Administración', cycle: 5 },
  ];

  describe('matchCareerFromCode', () => {
    it('retorna null si no hay código', () => {
      expect(matchCareerFromCode(null, careers)).toBeNull();
    });
    it('retorna null si no hay carreras', () => {
      expect(matchCareerFromCode('C-24', [])).toBeNull();
    });
    it('retorna null si ningún código es prefijo', () => {
      expect(matchCareerFromCode('XYZ-2024', careers)).toBeNull();
    });
    it('coincide por prefijo ', () => {
      expect(matchCareerFromCode('C-24-123', careers)).toEqual(careers[0]);
    });
    it('gana el prefijo más largo', () => {
      expect(matchCareerFromCode('DDS-2023-001', careers)).toEqual(careers[1]);
    });
    it('es case-insensitive', () => {
      expect(matchCareerFromCode('dds-2023-001', careers)).toEqual(careers[1]);
    });
  });

  describe('extractCycleFromCode', () => {
    it('extrae el ciclo de los dígitos tras el prefijo', () => {
      expect(extractCycleFromCode('C-5-123', careers[0])).toBe(5);
    });
    it('usa el ciclo configurado de la carrera si no hay dígitos', () => {
      expect(extractCycleFromCode('ADM-2023', careers[2])).toBe(5);
    });
    it('retorna null si no hay ciclo derivable', () => {
      expect(extractCycleFromCode('DDS-AB', careers[1])).toBeNull();
    });
    it('retorna null sin código', () => {
      expect(extractCycleFromCode('', null)).toBeNull();
    });
  });
});
