'use strict';

/** 404 - se llega aqui cuando ninguna ruta coincidio. */
function noEncontrado(req, res) {
  res.status(404).render('errors/404', { titulo: 'Pagina no encontrada' });
}

/** Manejador de errores central: siempre renderiza HTML, nunca JSON. */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  console.error('[error]', err);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    req.flash && req.flash('error', 'La imagen supera el tamano maximo permitido.');
    return res.redirect('back');
  }

  const status = err.status || 500;
  res.status(status).render('errors/500', {
    titulo: 'Ocurrio un error',
    mensaje: process.env.NODE_ENV === 'production' ? null : err.message,
  });
}

module.exports = { noEncontrado, manejadorErrores };
