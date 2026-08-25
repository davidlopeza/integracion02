'use strict';

const modelo = require('./conceptos.model');

async function listar(req, res, next) {
  try {
    const conceptos = await modelo.listar();
    const conceptosConUsos = await Promise.all(
      conceptos.map(async (c) => ({ ...c, usos: await modelo.contarUsos(c.id) }))
    );
    res.render('conceptos/lista', { titulo: 'Conceptos', conceptos: conceptosConUsos });
  } catch (err) {
    next(err);
  }
}

function mostrarFormularioCreacion(req, res) {
  res.render('conceptos/formulario', { titulo: 'Nuevo concepto', concepto: {}, accion: '/conceptos' });
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del concepto es obligatorio.');
      return res.status(400).render('conceptos/formulario', { titulo: 'Nuevo concepto', concepto: { nombre }, accion: '/conceptos' });
    }
    const existente = await modelo.buscarPorNombre(nombre.trim());
    if (existente) {
      req.flash('error', 'Ya existe un concepto con ese nombre.');
      return res.status(400).render('conceptos/formulario', { titulo: 'Nuevo concepto', concepto: { nombre }, accion: '/conceptos' });
    }
    await modelo.crear({ nombre: nombre.trim() });
    req.flash('exito', 'Concepto creado correctamente.');
    res.redirect('/conceptos');
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const concepto = await modelo.buscarPorId(req.params.id);
    if (!concepto) {
      req.flash('error', 'Concepto no encontrado.');
      return res.redirect('/conceptos');
    }
    res.render('conceptos/formulario', { titulo: 'Editar concepto', concepto, accion: `/conceptos/${concepto.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre del concepto es obligatorio.');
      return res.status(400).render('conceptos/formulario', {
        titulo: 'Editar concepto',
        concepto: { id: req.params.id, nombre },
        accion: `/conceptos/${req.params.id}?_method=PUT`,
      });
    }
    const actualizado = await modelo.actualizar(req.params.id, { nombre: nombre.trim() });
    if (!actualizado) {
      req.flash('error', 'Concepto no encontrado.');
      return res.redirect('/conceptos');
    }
    req.flash('exito', 'Concepto actualizado correctamente.');
    res.redirect('/conceptos');
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const usos = await modelo.contarUsos(req.params.id);
    if (usos > 0) {
      req.flash('error', `No se puede eliminar: el concepto esta definido en ${usos} libro(s).`);
      return res.redirect('/conceptos');
    }
    await modelo.eliminar(req.params.id);
    req.flash('exito', 'Concepto eliminado correctamente.');
    res.redirect('/conceptos');
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, mostrarFormularioCreacion, crear, mostrarFormularioEdicion, actualizar, eliminar };
