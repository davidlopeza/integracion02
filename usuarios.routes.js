'use strict';

const express = require('express');
const controlador = require('./usuarios.controller');
const { requiereAutenticacion, requiereAdministrador } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(requiereAutenticacion, requiereAdministrador);

router.get('/', controlador.listar);
router.put('/:id/activo', controlador.alternarActivo);
router.delete('/:id', controlador.eliminar);

module.exports = router;
