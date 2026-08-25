'use strict';

const usuariosModel = require('../modules/usuarios/usuarios.model');

/**
 * Carga el usuario autenticado (si lo hay) en req.usuario y en
 * res.locals.usuarioActual para que todas las vistas puedan usarlo
 * (por ejemplo, para mostrar/ocultar el menu de administracion).
 */
async function cargarUsuarioActual(req, res, next) {
  try {
    if (req.session && req.session.usuarioId) {
      const usuario = await usuariosModel.buscarPorId(req.session.usuarioId);
      req.usuario = usuario || null;
    } else {
      req.usuario = null;
    }
    res.locals.usuarioActual = req.usuario;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige que exista un usuario autenticado. */
function requiereAutenticacion(req, res, next) {
  if (!req.usuario) {
    req.flash('error', 'Debes iniciar sesion para continuar.');
    return res.redirect('/auth/login');
  }
  next();
}

/** Exige que el usuario autenticado tenga rol de administrador. */
function requiereAdministrador(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'administrador') {
    req.flash('error', 'Esta accion requiere permisos de administrador.');
    return res.redirect('/');
  }
  next();
}

module.exports = { cargarUsuarioActual, requiereAutenticacion, requiereAdministrador };
