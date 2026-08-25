'use strict';

const modelo = require('./formatos.model');

async function listar(req, res, next) {
  try {
    const formatos = await modelo.listar();
    res.render('formatos/lista', { titulo: 'Formatos', formatos });
  } catch (err) {
    next(err);
  }
}

function mostrarFormularioCreacion(req, res) {
  res.render('formatos/formulario', { titulo: 'Nuevo formato', formato: {}, accion: '/formatos' });
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del formato es obligatorio.');
      return res.status(400).render('formatos/formulario', { titulo: 'Nuevo formato', formato: { nombre }, accion: '/formatos' });
    }
    await modelo.crear({ nombre: nombre.trim() });
    req.flash('exito', 'Formato creado correctamente.');
    res.redirect('/formatos');
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const formato = await modelo.buscarPorId(req.params.id);
    if (!formato) {
      req.flash('error', 'Formato no encontrado.');
      return res.redirect('/formatos');
    }
    res.render('formatos/formulario', { titulo: 'Editar formato', formato, accion: `/formatos/${formato.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del formato es obligatorio.');
      return res.status(400).render('formatos/formulario', {
        titulo: 'Editar formato',
        formato: { id: req.params.id, nombre },
        accion: `/formatos/${req.params.id}?_method=PUT`,
      });
    }
    const actualizado = await modelo.actualizar(req.params.id, { nombre: nombre.trim() });
    if (!actualizado) {
      req.flash('error', 'Formato no encontrado.');
      return res.redirect('/formatos');
    }
    req.flash('exito', 'Formato actualizado correctamente.');
    res.redirect('/formatos');
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const totalLibros = await modelo.contarLibros(req.params.id);
    if (totalLibros > 0) {
      req.flash('error', `No se puede eliminar: hay ${totalLibros} libro(s) con este formato.`);
      return res.redirect('/formatos');
    }
    await modelo.eliminar(req.params.id);
    req.flash('exito', 'Formato eliminado correctamente.');
    res.redirect('/formatos');
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, mostrarFormularioCreacion, crear, mostrarFormularioEdicion, actualizar, eliminar };
