'use strict';

const modelo = require('./categorias.model');

async function listar(req, res, next) {
  try {
    const categorias = await modelo.listar();
    res.render('categorias/lista', { titulo: 'Categorias', categorias });
  } catch (err) {
    next(err);
  }
}

function mostrarFormularioCreacion(req, res) {
  res.render('categorias/formulario', { titulo: 'Nueva categoria', categoria: {}, accion: '/categorias' });
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre de la categoria es obligatorio.');
      return res.status(400).render('categorias/formulario', { titulo: 'Nueva categoria', categoria: { nombre }, accion: '/categorias' });
    }
    await modelo.crear({ nombre: nombre.trim() });
    req.flash('exito', 'Categoria creada correctamente.');
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const categoria = await modelo.buscarPorId(req.params.id);
    if (!categoria) {
      req.flash('error', 'Categoria no encontrada.');
      return res.redirect('/categorias');
    }
    res.render('categorias/formulario', { titulo: 'Editar categoria', categoria, accion: `/categorias/${categoria.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre de la categoria es obligatorio.');
      return res.status(400).render('categorias/formulario', {
        titulo: 'Editar categoria',
        categoria: { id: req.params.id, nombre },
        accion: `/categorias/${req.params.id}?_method=PUT`,
      });
    }
    const actualizado = await modelo.actualizar(req.params.id, { nombre: nombre.trim() });
    if (!actualizado) {
      req.flash('error', 'Categoria no encontrada.');
      return res.redirect('/categorias');
    }
    req.flash('exito', 'Categoria actualizada correctamente.');
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const totalLibros = await modelo.contarLibros(req.params.id);
    if (totalLibros > 0) {
      req.flash('error', `No se puede eliminar: hay ${totalLibros} libro(s) en esta categoria.`);
      return res.redirect('/categorias');
    }
    await modelo.eliminar(req.params.id);
    req.flash('exito', 'Categoria eliminada correctamente.');
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, mostrarFormularioCreacion, crear, mostrarFormularioEdicion, actualizar, eliminar };
