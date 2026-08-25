'use strict';

const modelo = require('./generos.model');

async function listar(req, res, next) {
  try {
    const generos = await modelo.listar();
    res.render('generos/lista', { titulo: 'Generos', generos });
  } catch (err) {
    next(err);
  }
}

function mostrarFormularioCreacion(req, res) {
  res.render('generos/formulario', { titulo: 'Nuevo genero', genero: {}, accion: '/generos' });
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del genero es obligatorio.');
      return res.status(400).render('generos/formulario', { titulo: 'Nuevo genero', genero: { nombre }, accion: '/generos' });
    }
    await modelo.crear({ nombre: nombre.trim() });
    req.flash('exito', 'Genero creado correctamente.');
    res.redirect('/generos');
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const genero = await modelo.buscarPorId(req.params.id);
    if (!genero) {
      req.flash('error', 'Genero no encontrado.');
      return res.redirect('/generos');
    }
    res.render('generos/formulario', { titulo: 'Editar genero', genero, accion: `/generos/${genero.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del genero es obligatorio.');
      return res.status(400).render('generos/formulario', {
        titulo: 'Editar genero',
        genero: { id: req.params.id, nombre },
        accion: `/generos/${req.params.id}?_method=PUT`,
      });
    }
    const actualizado = await modelo.actualizar(req.params.id, { nombre: nombre.trim() });
    if (!actualizado) {
      req.flash('error', 'Genero no encontrado.');
      return res.redirect('/generos');
    }
    req.flash('exito', 'Genero actualizado correctamente.');
    res.redirect('/generos');
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const totalLibros = await modelo.contarLibros(req.params.id);
    if (totalLibros > 0) {
      req.flash('error', `No se puede eliminar: hay ${totalLibros} libro(s) con este genero.`);
      return res.redirect('/generos');
    }
    await modelo.eliminar(req.params.id);
    req.flash('exito', 'Genero eliminado correctamente.');
    res.redirect('/generos');
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, mostrarFormularioCreacion, crear, mostrarFormularioEdicion, actualizar, eliminar };
