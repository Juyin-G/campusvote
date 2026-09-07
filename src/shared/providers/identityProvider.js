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

// IMPORTANTE: la verificación real del DNI la hace RENIEC contra su base de
// datos (número + nombres). El checksum mod-11 rechaza DNIs reales (incluso
// antiguos), por eso aquí NO se usa: el mock solo valida el formato.

export class MockIdentityProvider extends IdentityProvider {
  // El mock valida formato y checksum y "verifica" cualquier documento
  // plausible. Sin integración real con Reniec/PIDE.
  async validateDocument(documentType, documentNumber) {
    const normalized = String(documentNumber || '').trim().toUpperCase();

    if (documentType === 'DNI') {
      if (!DNI_PATTERN.test(normalized)) {
        return { verified: false, names: null, reason: 'El DNI debe tener 8 dígitos' };
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