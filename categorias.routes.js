'use strict';

const express = require('express');
const controlador = require('./categorias.controller');
const { requiereAutenticacion, requiereAdministrador } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(requiereAutenticacion, requiereAdministrador);

router.get('/', controlador.listar);
router.get('/nuevo', controlador.mostrarFormularioCreacion);
router.post('/', controlador.crear);
router.get('/:id/editar', controlador.mostrarFormularioEdicion);
router.put('/:id', controlador.actualizar);
router.delete('/:id', controlador.eliminar);

module.exports = router;
