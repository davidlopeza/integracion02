'use strict';

const express = require('express');
const controlador = require('./auth.controller');

const router = express.Router();

router.get('/registro', controlador.mostrarRegistro);
router.post('/registro', controlador.registrar);

router.get('/login', controlador.mostrarLogin);
router.post('/login', controlador.iniciarSesion);

router.post('/logout', controlador.cerrarSesion);

module.exports = router;
