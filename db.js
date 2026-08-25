'use strict';

// Acceso directo a PostgreSQL mediante el driver "pg" (sin ORM y sin
// capa de API intermedia). Se expone un pool de conexiones y un
// helper "query" que todos los modelos utilizan para ejecutar SQL
// parametrizado (evita inyeccion SQL).

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Errores en clientes inactivos del pool no deben tumbar el proceso.
  console.error('[db] Error inesperado en cliente inactivo del pool de PostgreSQL:', err);
});

/**
 * Ejecuta una consulta parametrizada contra PostgreSQL.
 * @param {string} texto  Sentencia SQL con placeholders $1, $2, ...
 * @param {Array}  parametros
 */
async function query(texto, parametros = []) {
  return pool.query(texto, parametros);
}

/**
 * Ejecuta una funcion dentro de una transaccion (BEGIN/COMMIT/ROLLBACK)
 * usando un unico cliente del pool. Necesario para operaciones que
 * escriben en varias tablas relacionadas (p. ej. libro + autores +
 * generos + conceptos) de forma atomica.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaccion };
