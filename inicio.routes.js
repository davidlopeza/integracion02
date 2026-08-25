'use strict';

const express = require('express');
const controlador = require('./inicio.controller');

const router = express.Router();

router.get('/', controlador.mostrarInicio);

module.exports = router;
