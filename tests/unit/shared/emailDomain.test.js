import {
  extractDomain,
  normalizeDomain,
  isDomainAllowed,
} from '../../../src/shared/utils/emailDomain.js';

describe('emailDomain util', () => {
  describe('extractDomain', () => {
    it('extrae el dominio de un correo en minúsculas', () => {
      expect(extractDomain('juan@Universidad.edu.pe')).toBe('universidad.edu.pe');
    });

    it('retorna vacío si no hay @', () => {
      expect(extractDomain('sinarroba')).toBe('');
    });
  });

  describe('normalizeDomain', () => {
    it('quita el @ inicial y pasa a minúsculas', () => {
      expect(normalizeDomain('@Gmail.com')).toBe('gmail.com');
    });
  });

  describe('isDomainAllowed', () => {
    it('permite un correo cuyo dominio está en la lista', () => {
      const allowed = ['universidad.edu.pe', 'gmail.com'];
      expect(isDomainAllowed('maria@gmail.com', allowed)).toBe(true);
      expect(isDomainAllowed('juan@universidad.edu.pe', allowed)).toBe(true);
    });

    it('rechaza un correo cuyo dominio no está en la lista', () => {
      const allowed = ['universidad.edu.pe'];
      expect(isDomainAllowed('maria@hotmail.com', allowed)).toBe(false);
    });

    it('rechaza si la lista de dominios está vacía', () => {
      expect(isDomainAllowed('maria@gmail.com', [])).toBe(false);
      expect(isDomainAllowed('maria@gmail.com', undefined)).toBe(false);
    });

    it('rechaza un correo sin @ o con dominio inválido', () => {
      expect(isDomainAllowed('sinarroba', ['gmail.com'])).toBe(false);
    });
  });
});
