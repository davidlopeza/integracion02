'use strict';

// Carga variables de entorno desde .env (si existe) y centraliza el
// acceso a la configuracion del proceso. Ningun modulo de la aplicacion
// debe leer process.env directamente: siempre debe pasar por aqui.
require('dotenv').config();

function requerido(nombre, porDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    if (porDefecto !== undefined) return porDefecto;
    throw new Error(`Falta la variable de entorno requerida: ${nombre}`);
  }
  return valor;
}

const env = {
  puerto: parseInt(requerido('PORT', '3000'), 10),
  entorno: requerido('NODE_ENV', 'development'),
  sessionSecret: requerido('SESSION_SECRET', 'clave-de-desarrollo-no-usar-en-produccion'),

  db: {
    host: requerido('PGHOST', '127.0.0.1'),
    port: parseInt(requerido('PGPORT', '5432'), 10),
    database: requerido('PGDATABASE', 'library_db'),
    user: requerido('PGUSER', 'library_user'),
    password: requerido('PGPASSWORD', 'library666'),
  },

  uploads: {
    maxBytes: parseInt(requerido('UPLOAD_MAX_BYTES', String(5 * 1024 * 1024)), 10),
  },
};

module.exports = env;
