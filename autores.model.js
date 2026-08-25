'use strict';

const { crearModeloCatalogo } = require('../../shared/catalogoModel');

const base = crearModeloCatalogo('autores', ['nombre', 'biografia']);

/** Cuantos libros tiene asociados un autor (para impedir borrados que rompan integridad). */
async function contarLibros(id) {
  return base.contarLibrosAsociados(id, 'libro_autores', 'autor_id');
}

module.exports = { ...base, contarLibros };
