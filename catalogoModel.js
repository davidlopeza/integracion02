'use strict';

// Fabrica de modelos para catalogos simples de una sola tabla
// (autores, generos, categorias, formatos, conceptos). Cada modulo
// sigue teniendo su propio archivo *.model.js (organizacion por
// modulos), pero reutiliza esta logica de acceso a datos comun para
// evitar repetir el mismo SQL parametrizado cinco veces.
//
// Todo el acceso a PostgreSQL es directo (pg) y con SQL parametrizado.

const { query } = require('../config/db');

/**
 * @param {string} tabla nombre de la tabla en PostgreSQL
 * @param {string[]} columnas columnas editables (ademas de "id")
 */
function crearModeloCatalogo(tabla, columnas) {
  const listaColumnas = columnas.join(', ');

  return {
    async listar({ orden = 'nombre' } = {}) {
      const { rows } = await query(`SELECT id, ${listaColumnas} FROM ${tabla} ORDER BY ${orden} ASC`);
      return rows;
    },

    async buscarPorId(id) {
      const { rows } = await query(`SELECT id, ${listaColumnas} FROM ${tabla} WHERE id = $1`, [id]);
      return rows[0] || null;
    },

    async crear(datos) {
      const valores = columnas.map((c) => datos[c]);
      const placeholders = columnas.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await query(
        `INSERT INTO ${tabla} (${listaColumnas}) VALUES (${placeholders}) RETURNING id, ${listaColumnas}`,
        valores
      );
      return rows[0];
    },

    async actualizar(id, datos) {
      const asignaciones = columnas.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const valores = columnas.map((c) => datos[c]);
      const { rows } = await query(
        `UPDATE ${tabla} SET ${asignaciones} WHERE id = $${columnas.length + 1} RETURNING id, ${listaColumnas}`,
        [...valores, id]
      );
      return rows[0] || null;
    },

    async eliminar(id) {
      await query(`DELETE FROM ${tabla} WHERE id = $1`, [id]);
    },

    async contarLibrosAsociados(id, tablaPuente, columnaFk) {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS total FROM ${tablaPuente} WHERE ${columnaFk} = $1`,
        [id]
      );
      return rows[0].total;
    },
  };
}

module.exports = { crearModeloCatalogo };
