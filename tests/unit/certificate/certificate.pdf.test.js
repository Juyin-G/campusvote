// tests/unit/certificate/certificate.pdf.test.js
// Pruebas unitarias del generador de PDFs de certificados.
// Verifica que el PDF generado:
//   * Es un buffer válido con magic number %PDF- y terminador %%EOF.
//   * Contiene los datos mínimos esperados (nombre de feria/proyecto/
//     participante, tipo, fecha de emisión, identificador) — verificados
//     a través del Info dictionary del PDF, que se almacena en claro
//     (cadenas UTF-16BE con BOM o ASCII entre paréntesis) y no requiere
//     parser externo.
//   * NO incluye DNI ni información sensible innecesaria.
//   * Para WINNER indica explícitamente que corresponde al ganador.
//   * Es determinista: misma entrada lógica → mismo conjunto de tokens
//     verificables.

import assert from 'node:assert/strict';

import {
  generateCertificatePdf,
} from '../../../src/modules/certificate/certificate.pdf.js';

const SAMPLE = {
  certificate: {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    issue_date: new Date('2026-02-01T12:00:00Z'),
    certificate_type: 'PARTICIPATION',
    description: null,
    valid_until: null,
  },
  fair: { id: 'fair-1', name: 'Feria de Proyectos 2026' },
  project: { id: 'project-1', name: 'Sistema de Riego Inteligente' },
  participant: { id: 'user-1', first_name: 'Ana', last_name: 'Pérez' },
};

const SAMPLE_WINNER = {
  ...SAMPLE,
  certificate: { ...SAMPLE.certificate, certificate_type: 'WINNER' },
};

const bufferToString = (buf) => buf.toString('latin1');

/**
 * Decodifica una cadena PDF UTF-16BE entre paréntesis con BOM.
 * PDFkit codifica cadenas con caracteres no-ASCII como UTF-16BE con BOM
 * (\xFE\xFF).
 */
const decodePdfUtf16 = (raw) => {
  const match = raw.match(/^\u0000/); // placeholder
  return null;
};

/** Extrae TODAS las cadenas parentizadas del PDF (UTF-16BE y ASCII). */
const extractAllStrings = (raw) => {
  const out = [];
  // Primero, las cadenas UTF-16BE con BOM.
  const utf16Re = /\(þÿ([^)]*)\)/g;
  let m;
  while ((m = utf16Re.exec(raw)) !== null) {
    const bytes = m[1];
    let str = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1);
      if (code === 0) continue;
      str += String.fromCharCode(code);
    }
    if (str) out.push(str);
  }
  // Luego, las cadenas ASCII entre paréntesis (sin BOM). Ignoramos las
  // que estén dentro de streams largos (hex Tj) y solo capturamos las
  // queparenecen metadata (objetos independientes con sus diccionarios).
  const asciiRe = /\((\s*[A-Za-z0-9 _|:.\-\/]+\s*)\)(?=\s*(?:PDF|D:|endobj|19))/g;
  while ((m = asciiRe.exec(raw)) !== null) {
    out.push(m[1].trim());
  }
  return out;
};

/**
 * Busca un token en el PDF considerando:
 *  - Cadenas UTF-16BE decodificadas (metadata Title/Subject).
 *  - Cadenas ASCII parentizadas (Keywords, Author, etc.).
 *  - Bytes raw (para tokens hex dentro de streams Tj).
 */
const pdfContains = (raw, token) => {
  const strings = extractAllStrings(raw);
  if (strings.some((s) => s.includes(token))) return true;
  // También busca en ASCII directo.
  if (raw.includes(token)) return true;
  // Y en hex (latin1 → hex) por si está dentro de un Tj stream.
  const hex = Buffer.from(token, 'latin1').toString('hex');
  return raw.toLowerCase().includes(hex.toLowerCase());
};

describe('generateCertificatePdf — estructura', () => {
  it('devuelve un Buffer con magic number %PDF- y terminador %%EOF', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 100);
    const text = bufferToString(buf);
    assert.equal(text.startsWith('%PDF-'), true);
    assert.equal(text.includes('%%EOF'), true);
  });

  it('incluye el título del certificado en el Info dictionary', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, 'Certificado de Participación'),
      'Esperaba "Certificado de Participación" en metadata del PDF'
    );
  });

  it('incluye el identificador único del certificado (UUID) en Keywords', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
      'Esperaba el UUID en Keywords del PDF'
    );
  });

  it('incluye el nombre de la feria en Keywords/Subject', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, 'Feria de Proyectos 2026'),
      'Esperaba nombre de feria en PDF'
    );
  });

  it('incluye el nombre del proyecto en Keywords', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, 'Sistema de Riego Inteligente'),
      'Esperaba nombre de proyecto en PDF'
    );
  });

  it('incluye el tipo PARTICIPATION en el Subject/Keywords', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, 'PARTICIPATION'),
      'Esperaba PARTICIPATION en PDF'
    );
  });

  it('incluye el nombre del participante en el cuerpo del PDF', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    // PDFkit guarda el texto del cuerpo en hex dentro de Tj.
    assert.ok(
      pdfContains(text, 'Ana'),
      'Esperaba nombre del participante en el cuerpo del PDF'
    );
  });

  it('NO incluye DNI (no se usa DNI como identificador)', async () => {
    const buf = await generateCertificatePdf({
      ...SAMPLE,
      participant: { id: 'user-1', first_name: 'Ana', last_name: 'Pérez', document_number: '12345678' },
    });
    const text = bufferToString(buf);
    assert.equal(text.includes('12345678'), false);
    assert.equal(text.toLowerCase().includes('dni'), false);
  });

  it('NO incluye email', async () => {
    const buf = await generateCertificatePdf({
      ...SAMPLE,
      participant: { id: 'user-1', first_name: 'Ana', last_name: 'Pérez', email: 'ana@campusvote.edu.pe' },
    });
    const text = bufferToString(buf);
    assert.equal(text.includes('ana@campusvote.edu.pe'), false);
  });

  it('incluye la fecha de emisión', async () => {
    const buf = await generateCertificatePdf(SAMPLE);
    const text = bufferToString(buf);
    assert.ok(
      pdfContains(text, '2026-02-01'),
      'Esperaba fecha de emisión (2026-02-01) en el PDF'
    );
  });
});

describe('generateCertificatePdf — WINNER', () => {
  it('incluye el tipo WINNER y un texto que lo identifica como ganador general', async () => {
    const buf = await generateCertificatePdf(SAMPLE_WINNER);
    const text = bufferToString(buf);
    assert.ok(pdfContains(text, 'WINNER'));
    assert.ok(
      pdfContains(text, 'Ganador'),
      'WINNER PDF debe indicar que corresponde al ganador general'
    );
  });
});

describe('generateCertificatePdf — determinismo lógico', () => {
  it('dos generaciones con la misma información producen los mismos tokens verificables', async () => {
    const a = await generateCertificatePdf(SAMPLE);
    const b = await generateCertificatePdf(SAMPLE);

    const textA = bufferToString(a);
    const textB = bufferToString(b);

    // Los datos identificadores deben coincidir en metadata.
    for (const token of [
      'Certificado de Participación',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'Feria de Proyectos 2026',
      'Sistema de Riego Inteligente',
      'PARTICIPATION',
    ]) {
      assert.ok(pdfContains(textA, token), `El token "${token}" debe estar en A`);
      assert.ok(pdfContains(textB, token), `El token "${token}" debe estar en B`);
    }
  });
});