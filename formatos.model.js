'use strict';

const { crearModeloCatalogo } = require('../../shared/catalogoModel');
const { query } = require('../../config/db');

const base = crearModeloCatalogo('formatos', ['nombre']);

async function contarLibros(id) {
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM libros WHERE formato_id = $1', [id]);
  return rows[0].total;
}

module.exports = { ...base, contarLibros };
