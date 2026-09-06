// src/shared/providers/identityProvider.js
// Interfaz de verificación de identidad nacional (RENIEC/PIDE) para el voto
// con DNI/CE. Hoy se entrega una implementación MOCK determinista que simula
// la consulta externa; en producción se reemplaza por el adaptador real
// (ReniecConsulta persona, PIDE, etc.) sin tocar el resto del sistema.

export class IdentityProvider {
  // Valida el documento y devuelve los datos verificados.
  // @returns Promise<{ verified: boolean, names: string|null, reason: string|null }>
  async validateDocument(_documentType, _documentNumber) {
    throw new Error('IdentityProvider.validateDocument() no implementado');
  }
}

const DNI_PATTERN = /^\d{8}$/;
const CE_PATTERN = /^[0-9A-Za-z]{9,12}$/;

// Checksum del DNI peruano (módulo 11, algoritmo de Reniec: 7 pesos sobre los
// primeros 7 dígitos; el 8.º dígito es el verificador y no participa en la suma).
const isValidDniChecksum = (dni) => {
  const weights = [3, 2, 7, 6, 5, 4, 3];
  const sum = dni.slice(0, 7).split('').reduce((acc, digit, i) => acc + parseInt(digit, 10) * weights[i], 0);
  const check = 11 - (sum % 11);
  if (check === 10 || check === 11) return dni[7] === '0';
  return parseInt(dni[7], 10) === check;
};

export class MockIdentityProvider extends IdentityProvider {
  // El mock valida formato y checksum y "verifica" cualquier documento
  // plausible. Sin integración real con Reniec/PIDE.
  async validateDocument(documentType, documentNumber) {
    const normalized = String(documentNumber || '').trim().toUpperCase();

    if (documentType === 'DNI') {
      if (!DNI_PATTERN.test(normalized)) {
        return { verified: false, names: null, reason: 'El DNI debe tener 8 dígitos' };
      }
      if (!isValidDniChecksum(normalized)) {
        return { verified: false, names: null, reason: 'El DNI no pasa el dígito verificador' };
      }
      return { verified: true, names: 'CIUDADANO PERUANO', reason: null };
    }

    if (documentType === 'CE') {
      if (!CE_PATTERN.test(normalized)) {
        return { verified: false, names: null, reason: 'Carné de Extranjería inválido' };
      }
      return { verified: true, names: 'CIUDADANO EXTRANJERO RESIDENTE', reason: null };
    }

    return { verified: false, names: null, reason: 'Tipo de documento no soportado' };
  }
}

export default new MockIdentityProvider();