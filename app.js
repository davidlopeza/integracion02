'use strict';

const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const env = require('./config/env');
const { cargarUsuarioActual } = require('./middlewares/auth.middleware');
const { noEncontrado, manejadorErrores } = require('./middlewares/errorHandler.middleware');

const rutasInicio = require('./modules/inicio/inicio.routes');
const rutasAuth = require('./modules/auth/auth.routes');
const rutasUsuarios = require('./modules/usuarios/usuarios.routes');
const rutasLibros = require('./modules/libros/libros.routes');
const rutasAutores = require('./modules/autores/autores.routes');
const rutasGeneros = require('./modules/generos/generos.routes');
const rutasCategorias = require('./modules/categorias/categorias.routes');
const rutasFormatos = require('./modules/formatos/formatos.routes');
const rutasConceptos = require('./modules/conceptos/conceptos.routes');

const app = express();

// ---------------------------------------------------------------------
// Motor de vistas: EJS + layout unico, todo HTML renderizado en el
// servidor (no hay SPA ni framework de cliente).
// ---------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout/principal');

// ---------------------------------------------------------------------
// Middlewares generales
// ---------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// Formularios HTML clasicos: application/x-www-form-urlencoded.
// (multipart/form-data para imagenes se procesa aparte, con multer,
// dentro del modulo de libros). Nunca se parsea/emite JSON ni XML.
app.use(express.urlencoded({ extended: true }));

// Permite que formularios HTML (que solo soportan GET/POST) invoquen
// semantica PUT/DELETE mediante un campo oculto "_method".
app.use(methodOverride('_method'));

app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'libreria.sid',
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
    // Almacen en memoria del proceso: suficiente para un monolito de
    // un unico proceso. En un despliegue con multiples instancias se
    // sustituiria por un almacen compartido (fuera del alcance de
    // este proyecto academico).
  })
);

app.use(flash());

// Adjunta req.usuario / res.locals.usuarioActual en cada peticion.
app.use(cargarUsuarioActual);

// Variables disponibles en todas las vistas.
app.use((req, res, next) => {
  res.locals.mensajesExito = req.flash('exito');
  res.locals.mensajesError = req.flash('error');
  res.locals.rutaActual = req.originalUrl;
  next();
});

// ---------------------------------------------------------------------
// Rutas por modulo (organizacion por modulos + patron MVC dentro de
// cada uno: *.routes.js -> *.controller.js -> *.model.js -> views/)
// ---------------------------------------------------------------------
app.use('/', rutasInicio);
app.use('/auth', rutasAuth);
app.use('/usuarios', rutasUsuarios);
app.use('/libros', rutasLibros);
app.use('/autores', rutasAutores);
app.use('/generos', rutasGeneros);
app.use('/categorias', rutasCategorias);
app.use('/formatos', rutasFormatos);
app.use('/conceptos', rutasConceptos);

// ---------------------------------------------------------------------
// 404 y manejador de errores (siempre renderizan HTML)
// ---------------------------------------------------------------------
app.use(noEncontrado);
app.use(manejadorErrores);

module.exports = app;
