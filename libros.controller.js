'use strict';

const fs = require('fs');
const path = require('path');

const modelo = require('./libros.model');
const autoresModel = require('../autores/autores.model');
const generosModel = require('../generos/generos.model');
const categoriasModel = require('../categorias/categorias.model');
const formatosModel = require('../formatos/formatos.model');
const conceptosModel = require('../conceptos/conceptos.model');
const { DIR_DESTINO } = require('../../middlewares/upload.middleware');

const REGEX_ISBN = /^[0-9Xx-]{10,20}$/;

function comoArreglo(valor) {
  if (valor === undefined || valor === null || valor === '') return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Combina conceptoNombre[] / conceptoDefinicion[] (arreglos paralelos del formulario) descartando filas vacias. */
function combinarConceptos(nombres, definiciones) {
  const listaNombres = comoArreglo(nombres);
  const listaDefiniciones = comoArreglo(definiciones);
  const pares = [];
  for (let i = 0; i < listaNombres.length; i += 1) {
    const nombre = (listaNombres[i] || '').trim();
    const definicion = (listaDefiniciones[i] || '').trim();
    if (nombre && definicion) pares.push({ nombre, definicion });
  }
  return pares;
}

async function catalogosParaFormulario() {
  const [autores, generos, categorias, formatos, conceptos] = await Promise.all([
    autoresModel.listar(),
    generosModel.listar(),
    categoriasModel.listar(),
    formatosModel.listar(),
    conceptosModel.listar(),
  ]);
  return { autores, generos, categorias, formatos, conceptos };
}

// ---------------------------------------------------------------------
// Catalogo publico
// ---------------------------------------------------------------------

async function listarPublico(req, res, next) {
  try {
    const { texto, categoriaId, generoId, formatoId, pagina } = req.query;
    const resultado = await modelo.listar({
      texto: texto || undefined,
      categoriaId: categoriaId || undefined,
      generoId: generoId || undefined,
      formatoId: formatoId || undefined,
      pagina: parseInt(pagina, 10) || 1,
    });
    const [categorias, generos, formatos] = await Promise.all([
      categoriasModel.listar(),
      generosModel.listar(),
      formatosModel.listar(),
    ]);
    res.render('libros/catalogo', {
      titulo: 'Catalogo de libros',
      ...resultado,
      categorias,
      generos,
      formatos,
      filtros: { texto, categoriaId, generoId, formatoId },
    });
  } catch (err) {
    next(err);
  }
}

async function verDetalle(req, res, next) {
  try {
    const libro = await modelo.buscarPorIsbn(req.params.isbn);
    if (!libro) {
      req.flash('error', 'Libro no encontrado.');
      return res.redirect('/libros');
    }
    res.render('libros/detalle', { titulo: libro.titulo, libro });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Administracion (CRUD)
// ---------------------------------------------------------------------

async function mostrarFormularioCreacion(req, res, next) {
  try {
    const catalogos = await catalogosParaFormulario();
    res.render('libros/formulario', {
      titulo: 'Nuevo libro',
      libro: {},
      seleccion: { autorIds: [], generoIds: [], conceptos: [] },
      accion: '/libros',
      esNuevo: true,
      ...catalogos,
    });
  } catch (err) {
    next(err);
  }
}

function validarCamposLibro(body, { validarIsbn = true } = {}) {
  const errores = [];
  const { isbn, titulo, anioPublicacion, precio, stock, formatoId, categoriaId } = body;

  if (validarIsbn && (!isbn || !REGEX_ISBN.test(isbn.trim()))) {
    errores.push('El ISBN no es valido (10 a 20 caracteres, digitos y guiones).');
  }
  if (!titulo || titulo.trim().length < 1) errores.push('El titulo es obligatorio.');

  const anio = parseInt(anioPublicacion, 10);
  if (!Number.isInteger(anio) || anio < 1450 || anio > 2100) errores.push('El año de publicacion no es valido.');

  const precioNum = Number(precio);
  if (Number.isNaN(precioNum) || precioNum < 0) errores.push('El precio debe ser un numero mayor o igual a 0.');

  const stockNum = parseInt(stock, 10);
  if (!Number.isInteger(stockNum) || stockNum < 0) errores.push('El stock debe ser un entero mayor o igual a 0.');

  if (!formatoId) errores.push('Debes seleccionar un formato.');
  if (!categoriaId) errores.push('Debes seleccionar una categoria.');

  return { errores, anio, precioNum, stockNum };
}

async function crear(req, res, next) {
  try {
    const { isbn, titulo, descripcion, formatoId, categoriaId } = req.body;
    const autorIds = comoArreglo(req.body.autorIds).map(Number);
    const generoIds = comoArreglo(req.body.generoIds).map(Number);
    const paresConceptos = combinarConceptos(req.body.conceptoNombre, req.body.conceptoDefinicion);

    const { errores, anio, precioNum, stockNum } = validarCamposLibro(req.body);
    if (autorIds.length === 0) errores.push('Selecciona al menos un autor.');
    if (generoIds.length === 0) errores.push('Selecciona al menos un genero.');

    if (errores.length === 0 && (await modelo.existeIsbn(isbn.trim()))) {
      errores.push('Ya existe un libro registrado con ese ISBN.');
    }

    if (errores.length > 0) {
      errores.forEach((e) => req.flash('error', e));
      const catalogos = await catalogosParaFormulario();
      return res.status(400).render('libros/formulario', {
        titulo: 'Nuevo libro',
        libro: req.body,
        seleccion: { autorIds, generoIds, conceptos: paresConceptos },
        accion: '/libros',
        esNuevo: true,
        ...catalogos,
      });
    }

    // Resuelve/crea los conceptos por nombre y arma los pares (id, definicion).
    const conceptosResueltos = [];
    for (const { nombre, definicion } of paresConceptos) {
      const concepto = await conceptosModel.obtenerOCrear(nombre);
      conceptosResueltos.push({ conceptoId: concepto.id, definicion });
    }

    await modelo.crear(
      {
        isbn: isbn.trim(),
        titulo: titulo.trim(),
        anioPublicacion: anio,
        precio: precioNum,
        stock: stockNum,
        formatoId: Number(formatoId),
        categoriaId: Number(categoriaId),
        descripcion: descripcion ? descripcion.trim() : null,
      },
      autorIds,
      generoIds,
      conceptosResueltos
    );

    if (req.files && req.files.length > 0) {
      await modelo.agregarImagenes(isbn.trim(), req.files);
    }

    req.flash('exito', 'Libro creado correctamente.');
    res.redirect(`/libros/${encodeURIComponent(isbn.trim())}`);
  } catch (err) {
    next(err);
  }
}

async function mostrarFormularioEdicion(req, res, next) {
  try {
    const libro = await modelo.buscarPorIsbn(req.params.isbn);
    if (!libro) {
      req.flash('error', 'Libro no encontrado.');
      return res.redirect('/libros');
    }
    const catalogos = await catalogosParaFormulario();
    res.render('libros/formulario', {
      titulo: `Editar: ${libro.titulo}`,
      libro,
      seleccion: {
        autorIds: libro.autores.map((a) => a.id),
        generoIds: libro.generos.map((g) => g.id),
        conceptos: libro.conceptos.map((c) => ({ nombre: c.nombre, definicion: c.definicion })),
      },
      accion: `/libros/${encodeURIComponent(libro.isbn)}?_method=PUT`,
      esNuevo: false,
      ...catalogos,
    });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const isbn = req.params.isbn;
    const { titulo, descripcion, formatoId, categoriaId } = req.body;
    const autorIds = comoArreglo(req.body.autorIds).map(Number);
    const generoIds = comoArreglo(req.body.generoIds).map(Number);
    const paresConceptos = combinarConceptos(req.body.conceptoNombre, req.body.conceptoDefinicion);

    const { errores, anio, precioNum, stockNum } = validarCamposLibro(req.body, { validarIsbn: false });
    if (autorIds.length === 0) errores.push('Selecciona al menos un autor.');
    if (generoIds.length === 0) errores.push('Selecciona al menos un genero.');

    if (errores.length > 0) {
      errores.forEach((e) => req.flash('error', e));
      const catalogos = await catalogosParaFormulario();
      return res.status(400).render('libros/formulario', {
        titulo: `Editar: ${titulo || isbn}`,
        libro: { ...req.body, isbn },
        seleccion: { autorIds, generoIds, conceptos: paresConceptos },
        accion: `/libros/${encodeURIComponent(isbn)}?_method=PUT`,
        esNuevo: false,
        ...catalogos,
      });
    }

    const conceptosResueltos = [];
    for (const { nombre, definicion } of paresConceptos) {
      const concepto = await conceptosModel.obtenerOCrear(nombre);
      conceptosResueltos.push({ conceptoId: concepto.id, definicion });
    }

    await modelo.actualizar(
      isbn,
      {
        titulo: titulo.trim(),
        anioPublicacion: anio,
        precio: precioNum,
        stock: stockNum,
        formatoId: Number(formatoId),
        categoriaId: Number(categoriaId),
        descripcion: descripcion ? descripcion.trim() : null,
      },
      autorIds,
      generoIds,
      conceptosResueltos
    );

    if (req.files && req.files.length > 0) {
      await modelo.agregarImagenes(isbn, req.files);
    }

    req.flash('exito', 'Libro actualizado correctamente.');
    res.redirect(`/libros/${encodeURIComponent(isbn)}`);
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const libro = await modelo.buscarPorIsbn(req.params.isbn);
    if (libro) {
      // Borra los archivos de imagen del disco antes de borrar el registro
      // (las filas se eliminan en cascada al borrar el libro).
      for (const imagen of libro.imagenes) {
        const rutaAbsoluta = path.join(DIR_DESTINO, path.basename(imagen.ruta_archivo));
        fs.unlink(rutaAbsoluta, () => {});
      }
    }
    await modelo.eliminar(req.params.isbn);
    req.flash('exito', 'Libro eliminado correctamente.');
    res.redirect('/libros');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Imagenes de un libro
// ---------------------------------------------------------------------

async function eliminarImagen(req, res, next) {
  try {
    const imagen = await modelo.buscarImagen(req.params.idImagen);
    if (imagen) {
      const rutaAbsoluta = path.join(DIR_DESTINO, path.basename(imagen.ruta_archivo));
      fs.unlink(rutaAbsoluta, () => {});
      await modelo.eliminarImagen(req.params.idImagen);
      req.flash('exito', 'Imagen eliminada.');
    }
    res.redirect(`/libros/${encodeURIComponent(req.params.isbn)}/editar`);
  } catch (err) {
    next(err);
  }
}

async function marcarPortada(req, res, next) {
  try {
    await modelo.marcarPortada(req.params.isbn, req.params.idImagen);
    req.flash('exito', 'Portada actualizada.');
    res.redirect(`/libros/${encodeURIComponent(req.params.isbn)}/editar`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarPublico,
  verDetalle,
  mostrarFormularioCreacion,
  crear,
  mostrarFormularioEdicion,
  actualizar,
  eliminar,
  eliminarImagen,
  marcarPortada,
};
