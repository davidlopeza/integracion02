'use strict';

// Punto de entrada del proceso Node.js. Mantiene server.js separado de
// src/app.js para poder importar la app en pruebas sin levantar un
// puerto real.

const app = require('./src/app');
const env = require('./src/config/env');
const { pool } = require('./src/config/db');

const servidor = app.listen(env.puerto, () => {
  console.log(`Libreria en linea escuchando en http://localhost:${env.puerto} (entorno: ${env.entorno})`);
});

async function apagar(señal) {
  console.log(`\nRecibida ${señal}, cerrando servidor...`);
  servidor.close(async () => {
    try {
      await pool.end();
      console.log('Pool de PostgreSQL cerrado. Adios.');
      process.exit(0);
    } catch (err) {
      console.error('Error cerrando el pool de PostgreSQL:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
