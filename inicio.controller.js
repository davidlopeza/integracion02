'use strict';

const librosModel = require('../libros/libros.model');

async function mostrarInicio(req, res, next) {
  try {
    const { libros } = await librosModel.listar({ pagina: 1 });
    res.render('inicio/index', { titulo: 'Inicio', librosDestacados: libros.slice(0, 6) });
  } catch (err) {
    next(err);
  }
}

module.exports = { mostrarInicio };
