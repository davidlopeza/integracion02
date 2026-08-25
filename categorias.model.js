'use strict';

const { crearModeloCatalogo } = require('../../shared/catalogoModel');

const base = crearModeloCatalogo('categorias', ['nombre']);

async function contarLibros(id) {
  const { query } = require('../../config/db');
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM libros WHERE categoria_id = $1', [id]);
  return rows[0].total;
}

module.exports = { ...base, contarLibros };
