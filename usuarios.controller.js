'use strict';

const usuariosModel = require('./usuarios.model');

/** Listado de usuarios registrados (solo administrador). */
async function listar(req, res, next) {
  try {
    const usuarios = await usuariosModel.listar();
    res.render('usuarios/lista', { titulo: 'Usuarios registrados', usuarios });
  } catch (err) {
    next(err);
  }
}

/** Activa o desactiva una cuenta de cliente (no se puede desactivar al administrador). */
async function alternarActivo(req, res, next) {
  try {
    const { id } = req.params;
    const usuario = await usuariosModel.buscarPorId(id);
    if (!usuario) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/usuarios');
    }
    if (usuario.rol === 'administrador') {
      req.flash('error', 'No se puede desactivar la cuenta de administrador.');
      return res.redirect('/usuarios');
    }
    await usuariosModel.cambiarActivo(id, !usuario.activo);
    req.flash('exito', `Usuario ${usuario.activo ? 'desactivado' : 'activado'} correctamente.`);
    res.redirect('/usuarios');
  } catch (err) {
    next(err);
  }
}

/** Elimina una cuenta de cliente (nunca al administrador). */
async function eliminar(req, res, next) {
  try {
    const { id } = req.params;
    const usuario = await usuariosModel.buscarPorId(id);
    if (!usuario) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/usuarios');
    }
    if (usuario.rol === 'administrador') {
      req.flash('error', 'No se puede eliminar la cuenta de administrador.');
      return res.redirect('/usuarios');
    }
    await usuariosModel.eliminar(id);
    req.flash('exito', 'Usuario eliminado correctamente.');
    res.redirect('/usuarios');
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, alternarActivo, eliminar };
