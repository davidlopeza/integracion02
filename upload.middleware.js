'use strict';

// Configuracion de subida de imagenes de portada/galeria de libros.
// Las imagenes se reciben como multipart/form-data (formulario HTML
// clasico) y se guardan como archivos en disco bajo public/uploads;
// en la base de datos solo se conserva la ruta relativa del archivo.
// En ningun momento se codifica la imagen como JSON/base64 para
// "intercambiarla": es una subida de archivo binario estandar.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');

const DIR_DESTINO = path.join(__dirname, '..', '..', 'public', 'uploads', 'libros');
fs.mkdirSync(DIR_DESTINO, { recursive: true });

const EXTENSIONES_PERMITIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_DESTINO),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombreUnico = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, nombreUnico);
  },
});

function filtroArchivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.has(ext)) {
    return cb(new Error('Formato de imagen no permitido. Usa JPG, PNG, WEBP o GIF.'));
  }
  cb(null, true);
}

const subirImagenes = multer({
  storage,
  fileFilter: filtroArchivo,
  limits: { fileSize: env.uploads.maxBytes, files: 10 },
});

module.exports = { subirImagenes, DIR_DESTINO };
