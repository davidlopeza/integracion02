'use strict';

const { crearModeloCatalogo } = require('../../shared/catalogoModel');

const base = crearModeloCatalogo('generos', ['nombre']);

async function contarLibros(id) {
  return base.contarLibrosAsociados(id, 'libro_generos', 'genero_id');
}

module.exports = { ...base, contarLibros };
