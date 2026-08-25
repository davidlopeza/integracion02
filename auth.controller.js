'use strict';

const bcrypt = require('bcryptjs');
const usuariosModel = require('../usuarios/usuarios.model');

const RONDAS_SAL = 10;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mostrarRegistro(req, res) {
  if (req.usuario) return res.redirect('/');
  res.render('auth/registro', { titulo: 'Crear cuenta', valores: {} });
}

async function registrar(req, res, next) {
  try {
    const { nombre, email, password, confirmarPassword } = req.body;
    const errores = [];

    if (!nombre || nombre.trim().length < 2) errores.push('El nombre debe tener al menos 2 caracteres.');
    if (!email || !REGEX_EMAIL.test(email)) errores.push('El correo electronico no es valido.');
    if (!password || password.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmarPassword) errores.push('Las contraseñas no coinciden.');

    if (errores.length === 0) {
      const existente = await usuariosModel.buscarPorEmail(email);
      if (existente) errores.push('Ya existe una cuenta registrada con ese correo.');
    }

    if (errores.length > 0) {
      errores.forEach((e) => req.flash('error', e));
      return res.status(400).render('auth/registro', {
        titulo: 'Crear cuenta',
        valores: { nombre, email },
      });
    }

    const passwordHash = await bcrypt.hash(password, RONDAS_SAL);
    const usuario = await usuariosModel.crear({ nombre: nombre.trim(), email, passwordHash });

    req.session.usuarioId = usuario.id;
    req.flash(
      'exito',
      usuario.rol === 'administrador'
        ? 'Cuenta creada. Al ser el primer registro, esta cuenta es la administradora del sistema.'
        : 'Cuenta creada correctamente. ¡Bienvenido/a!'
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
}

function mostrarLogin(req, res) {
  if (req.usuario) return res.redirect('/');
  res.render('auth/login', { titulo: 'Iniciar sesion', valores: {} });
}

async function iniciarSesion(req, res, next) {
  try {
    const { email, password } = req.body;
    const usuario = email ? await usuariosModel.buscarPorEmail(email) : null;

    const credencialesValidas =
      usuario && (await bcrypt.compare(password || '', usuario.password_hash));

    if (!credencialesValidas) {
      req.flash('error', 'Correo o contraseña incorrectos.');
      return res.status(401).render('auth/login', { titulo: 'Iniciar sesion', valores: { email } });
    }

    if (!usuario.activo) {
      req.flash('error', 'Esta cuenta ha sido desactivada. Contacta al administrador.');
      return res.status(403).render('auth/login', { titulo: 'Iniciar sesion', valores: { email } });
    }

    req.session.usuarioId = usuario.id;
    req.flash('exito', `Bienvenido/a, ${usuario.nombre}.`);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
}

function cerrarSesion(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('libreria.sid');
    res.redirect('/auth/login');
  });
}

module.exports = { mostrarRegistro, registrar, mostrarLogin, iniciarSesion, cerrarSesion };
