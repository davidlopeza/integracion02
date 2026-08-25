'use strict';

const { query } = require('../../config/db');

const COLUMNAS_PUBLICAS = 'id, nombre, email, rol, activo, fecha_registro';

async function contarUsuarios() {
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM usuarios');
  return rows[0].total;
}

async function existeAdministrador() {
  const { rows } = await query("SELECT 1 FROM usuarios WHERE rol = 'administrador' LIMIT 1");
  return rows.length > 0;
}

async function buscarPorEmail(email) {
  const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${COLUMNAS_PUBLICAS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Crea un usuario registrado. El PRIMER usuario que se registra en el
 * sistema se promueve automaticamente a "administrador"; el resto
 * queda como "cliente". Esto garantiza, junto con el indice unico
 * parcial de la base de datos, que exista como maximo un administrador
 * sin exponer esa decision al formulario publico de registro.
 */
async function crear({ nombre, email, passwordHash }) {
  const hayAdmin = await existeAdministrador();
  const rol = hayAdmin ? 'cliente' : 'administrador';
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS_PUBLICAS}`,
    [nombre, email.toLowerCase(), passwordHash, rol]
  );
  return rows[0];
}

async function listar() {
  const { rows } = await query(`SELECT ${COLUMNAS_PUBLICAS} FROM usuarios ORDER BY fecha_registro DESC`);
  return rows;
}

async function cambiarActivo(id, activo) {
  const { rows } = await query(
    `UPDATE usuarios SET activo = $2 WHERE id = $1 RETURNING ${COLUMNAS_PUBLICAS}`,
    [id, activo]
  );
  return rows[0] || null;
}

async function eliminar(id) {
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

module.exports = {
  contarUsuarios,
  existeAdministrador,
  buscarPorEmail,
  buscarPorId,
  crear,
  listar,
  cambiarActivo,
  eliminar,
};
