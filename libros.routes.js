'use strict';

const express = require('express');
const controlador = require('./libros.controller');
const { requiereAutenticacion, requiereAdministrador } = require('../../middlewares/auth.middleware');
const { subirImagenes } = require('../../middlewares/upload.middleware');

const router = express.Router();
const soloAdmin = [requiereAutenticacion, requiereAdministrador];

// --- Catalogo publico (cualquier visitante) ---
router.get('/', controlador.listarPublico);

// --- Administracion (rutas estaticas antes de la dinamica /:isbn) ---
router.get('/nuevo', ...soloAdmin, controlador.mostrarFormularioCreacion);
router.post('/', ...soloAdmin, subirImagenes.array('imagenes', 10), controlador.crear);

router.get('/:isbn/editar', ...soloAdmin, controlador.mostrarFormularioEdicion);
router.put('/:isbn', ...soloAdmin, subirImagenes.array('imagenes', 10), controlador.actualizar);
router.delete('/:isbn', ...soloAdmin, controlador.eliminar);

router.delete('/:isbn/imagenes/:idImagen', ...soloAdmin, controlador.eliminarImagen);
router.put('/:isbn/imagenes/:idImagen/portada', ...soloAdmin, controlador.marcarPortada);

// --- Detalle publico (debe ir despues de las rutas estaticas anteriores) ---
router.get('/:isbn', controlador.verDetalle);

module.exports = router;
