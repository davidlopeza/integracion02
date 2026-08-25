'use strict';

const { crearModeloCatalogo } = require('../../shared/catalogoModel');
const { query } = require('../../config/db');

const base = crearModeloCatalogo('conceptos', ['nombre']);

/** Cuantos libros usan este concepto (via libro_conceptos). */
async function contarUsos(id) {
  return base.contarLibrosAsociados(id, 'libro_conceptos', 'concepto_id');
}

/** Busca un concepto por nombre exacto (para reutilizar conceptos ya existentes). */
async function buscarPorNombre(nombre) {
  const { rows } = await query('SELECT id, nombre FROM conceptos WHERE lower(nombre) = lower($1)', [nombre]);
  return rows[0] || null;
}

/** Devuelve el concepto existente con ese nombre, o lo crea si no existe. */
async function obtenerOCrear(nombre) {
  const existente = await buscarPorNombre(nombre);
  if (existente) return existente;
  return base.crear({ nombre: nombre.trim() });
}

module.exports = { ...base, contarUsos, buscarPorNombre, obtenerOCrear };
