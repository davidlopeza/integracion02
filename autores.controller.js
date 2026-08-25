'use strict';

const modelo = require('./autores.model');

async function listar(req, res, next) {
  try {
    const autores = await modelo.listar();
    res.render('autores/lista', { titulo: 'Autores', autores });
  } catch (err) {
    next(err);
  }
}

function mostrarFormularioCreacion(req, res) {
  res.render('autores/formulario', { titulo: 'Nuevo autor', autor: {}, accion: '/autores' });
}

async function crear(req, res, next) {
  try {
    const { nombre, biografia } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del autor es obligatorio (minimo 2 caracteres).');
      return res.status(400).render('autores/formulario', {
        titulo: 'Nuevo autor',
        autor: { nombre, biografia },
        accion: '/autores',
      });
    }
    await modelo.crear({ nombre: nombre.trim(), biografia: biografia || null });
    req.flash('exito', 'Autor creado correctamente.');
    res.redirect('/autores');
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const autor = await modelo.buscarPorId(req.params.id);
    if (!autor) {
      req.flash('error', 'Autor no encontrado.');
      return res.redirect('/autores');
    }
    res.render('autores/formulario', {
      titulo: 'Editar autor',
      autor,
      accion: `/autores/${autor.id}?_method=PUT`,
    });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, biografia } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del autor es obligatorio (minimo 2 caracteres).');
      return res.status(400).render('autores/formulario', {
        titulo: 'Editar autor',
        autor: { id: req.params.id, nombre, biografia },
        accion: `/autores/${req.params.id}?_method=PUT`,
      });
    }
    const actualizado = await modelo.actualizar(req.params.id, { nombre: nombre.trim(), biografia: biografia || null });
    if (!actualizado) {
      req.flash('error', 'Autor no encontrado.');
      return res.redirect('/autores');
    }
    req.flash('exito', 'Autor actualizado correctamente.');
    res.redirect('/autores');
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const totalLibros = await modelo.contarLibros(req.params.id);
    if (totalLibros > 0) {
      req.flash('error', `No se puede eliminar: hay ${totalLibros} libro(s) asociados a este autor.`);
      return res.redirect('/autores');
    }
    await modelo.eliminar(req.params.id);
    req.flash('exito', 'Autor eliminado correctamente.');
    res.redirect('/autores');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  mostrarFormularioCreacion,
  crear,
  mostrarFormularioEdicion,
  actualizar,
  eliminar,
};
