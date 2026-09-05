// scripts/verify-i18n.js
// Verifica la consistencia del diccionario de traducciones (i18n).
// Reglas:
//   1. Cada registro debe tener al menos los locales base: es-PE y es
//      (el fallback en BD es es-PE -> es -> clave).
//   2. Dentro de cada categoría, los registros deben tener una cobertura
//      de locales uniforme (si una clave del diccionario está traducida a
//      en-US, las demás de la categoría deben tener en-US).
//   3. El formato de clave debe cumplir ^[a-z0-9._-]+$.
//
// Uso:
//   node scripts/verify-i18n.js              # usa MIGRATION_DATABASE_URL o DATABASE_URL
//   MIGRATION_DATABASE_URL=... node scripts/verify-i18n.js

import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';

const REQUIRED_LOCALES = ['es-PE', 'es'];
const KEY_FORMAT = /^[a-z0-9._-]+$/;
const DB_URL = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('FATAL: MIGRATION_DATABASE_URL o DATABASE_URL no está configurada.');
  process.exit(1);
}

const client = new Client({ connectionString: DB_URL });

async function main() {
  await client.connect();

  const { rows } = await client.query(
    `SELECT translation_key, category, values FROM platform_translations ORDER BY category, translation_key`
  );

  if (rows.length === 0) {
    console.log('i18n: diccionario vacío, sin errores.');
    await client.end();
    return;
  }

  const errors = [];
  const warnings = [];

  const byCategory = new Map();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }

  // Cobertura de locales por categoría (sin contar los requeridos).
  const coverageByCategory = new Map();
  for (const [category, records] of byCategory) {
    const locales = new Set();
    for (const r of records) {
      for (const key of Object.keys(r.values || {})) locales.add(key);
    }
    REQUIRED_LOCALES.forEach((l) => locales.delete(l));
    coverageByCategory.set(category, locales);
  }

  for (const row of rows) {
    const { translation_key, category, values } = row;

    if (!KEY_FORMAT.test(translation_key)) {
      errors.push(`[${category}] "${translation_key}" no cumple ^[a-z0-9._-]+$`);
    }

    const locales = Object.keys(values || {});

    for (const required of REQUIRED_LOCALES) {
      if (!locales.includes(required)) {
        errors.push(
          `[${category}] "${translation_key}" no tiene el locale obligatorio "${required}"`
        );
      }
    }

    const expected = coverageByCategory.get(category);
    for (const locale of expected) {
      if (!locales.includes(locale)) {
        warnings.push(
          `[${category}] "${translation_key}" no tiene el locale "${locale}" que sí existe en otras claves de la categoría`
        );
      }
    }
  }

  if (errors.length) {
    console.error(`\ni18n: ${errors.length} error(es) — faltan locales obligatorios o claves inválidas:`);
    errors.forEach((e) => console.error(`  [ERROR] ${e}`));
  } else {
    console.log(`\ni18n: ${rows.length} claves verificadas. Locales obligatorios OK.`);
  }

  if (warnings.length) {
    console.warn(`\ni18n: ${warnings.length} advertencia(s) de cobertura uniforme:`);
    warnings.slice(0, 20).forEach((w) => console.warn(`  [WARN]  ${w}`));
    if (warnings.length > 20) console.warn(`  ... (+${warnings.length - 20} más)`);
  }

  await client.end();

  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error('i18n: no se pudo verificar el diccionario.', err);
  process.exit(1);
});