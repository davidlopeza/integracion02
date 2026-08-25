'use strict';

const { query, transaccion } = require('../../config/db');

const LIMITE_PAGINA = 12;

/**
 * Lista libros para el catalogo publico, con filtros opcionales y
 * paginacion. Devuelve datos ya "aplanados" (formato/categoria como
 * texto, portada resuelta) para simplificar la vista.
 */
async function listar({ texto, categoriaId, generoId, formatoId, pagina = 1 } = {}) {
  const condiciones = [];
  const valores = [];

  if (texto) {
    valores.push(`%${texto}%`);
    condiciones.push(`(l.titulo ILIKE $${valores.length} OR EXISTS (
      SELECT 1 FROM libro_autores la JOIN autores a ON a.id = la.autor_id
      WHERE la.libro_isbn = l.isbn AND a.nombre ILIKE $${valores.length}
    ))`);
  }
  if (categoriaId) {
    valores.push(categoriaId);
    condiciones.push(`l.categoria_id = $${valores.length}`);
  }
  if (formatoId) {
    valores.push(formatoId);
    condiciones.push(`l.formato_id = $${valores.length}`);
  }
  if (generoId) {
    valores.push(generoId);
    condiciones.push(`EXISTS (SELECT 1 FROM libro_generos lg WHERE lg.libro_isbn = l.isbn AND lg.genero_id = $${valores.length})`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desplazamiento = (Math.max(1, pagina) - 1) * LIMITE_PAGINA;

  const { rows: totalRows } = await query(`SELECT COUNT(*)::int AS total FROM libros l ${where}`, valores);
  const total = totalRows[0].total;

  valores.push(LIMITE_PAGINA, desplazamiento);
  const { rows } = await query(
    `SELECT
        l.isbn, l.titulo, l.anio_publicacion, l.precio, l.stock, l.descripcion,
        f.nombre AS formato, c.nombre AS categoria,
        (SELECT ruta_archivo FROM libro_imagenes WHERE libro_isbn = l.isbn AND es_portada = true LIMIT 1) AS portada,
        (SELECT string_agg(a.nombre, ', ' ORDER BY a.nombre)
           FROM libro_autores la JOIN autores a ON a.id = la.autor_id WHERE la.libro_isbn = l.isbn) AS autores
     FROM libros l
     JOIN formatos f ON f.id = l.formato_id
     JOIN categorias c ON c.id = l.categoria_id
     ${where}
     ORDER BY l.fecha_creacion DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores
  );

  return {
    libros: rows,
    total,
    pagina: Math.max(1, pagina),
    totalPaginas: Math.max(1, Math.ceil(total / LIMITE_PAGINA)),
  };
}

/** Ficha completa de un libro: datos propios + todas sus relaciones. */
async function buscarPorIsbn(isbn) {
  const { rows } = await query(
    `SELECT l.*, f.nombre AS formato, c.nombre AS categoria
     FROM libros l
     JOIN formatos f ON f.id = l.formato_id
     JOIN categorias c ON c.id = l.categoria_id
     WHERE l.isbn = $1`,
    [isbn]
  );
  const libro = rows[0];
  if (!libro) return null;

  const [autores, generos, conceptos, imagenes] = await Promise.all([
    query(
      `SELECT a.id, a.nombre FROM libro_autores la
       JOIN autores a ON a.id = la.autor_id WHERE la.libro_isbn = $1 ORDER BY a.nombre`,
      [isbn]
    ),
    query(
      `SELECT g.id, g.nombre FROM libro_generos lg
       JOIN generos g ON g.id = lg.genero_id WHERE lg.libro_isbn = $1 ORDER BY g.nombre`,
      [isbn]
    ),
    query(
      `SELECT c.id, c.nombre, lc.definicion FROM libro_conceptos lc
       JOIN conceptos c ON c.id = lc.concepto_id WHERE lc.libro_isbn = $1 ORDER BY c.nombre`,
      [isbn]
    ),
    query(
      `SELECT id, ruta_archivo, texto_alt, es_portada, orden FROM libro_imagenes
       WHERE libro_isbn = $1 ORDER BY es_portada DESC, orden ASC, id ASC`,
      [isbn]
    ),
  ]);

  return {
    ...libro,
    autores: autores.rows,
    generos: generos.rows,
    conceptos: conceptos.rows,
    imagenes: imagenes.rows,
  };
}

async function existeIsbn(isbn) {
  const { rows } = await query('SELECT 1 FROM libros WHERE isbn = $1', [isbn]);
  return rows.length > 0;
}

/**
 * Crea un libro junto con sus relaciones multivaluadas (autores,
 * generos, conceptos con definicion) en una unica transaccion.
 * @param {object} datosLibro campos propios de la tabla libros
 * @param {number[]} autorIds
 * @param {number[]} generoIds
 * @param {{conceptoId: number, definicion: string}[]} conceptos
 */
async function crear(datosLibro, autorIds, generoIds, conceptos) {
  return transaccion(async (client) => {
    await client.query(
      `INSERT INTO libros (isbn, titulo, anio_publicacion, precio, stock, formato_id, categoria_id, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        datosLibro.isbn,
        datosLibro.titulo,
        datosLibro.anioPublicacion,
        datosLibro.precio,
        datosLibro.stock,
        datosLibro.formatoId,
        datosLibro.categoriaId,
        datosLibro.descripcion,
      ]
    );

    await insertarRelaciones(client, datosLibro.isbn, autorIds, generoIds, conceptos);
    return datosLibro.isbn;
  });
}

/** Reemplaza los datos propios y TODAS las relaciones del libro. */
async function actualizar(isbn, datosLibro, autorIds, generoIds, conceptos) {
  return transaccion(async (client) => {
    await client.query(
      `UPDATE libros SET titulo = $2, anio_publicacion = $3, precio = $4, stock = $5,
              formato_id = $6, categoria_id = $7, descripcion = $8
       WHERE isbn = $1`,
      [
        isbn,
        datosLibro.titulo,
        datosLibro.anioPublicacion,
        datosLibro.precio,
        datosLibro.stock,
        datosLibro.formatoId,
        datosLibro.categoriaId,
        datosLibro.descripcion,
      ]
    );

    await client.query('DELETE FROM libro_autores WHERE libro_isbn = $1', [isbn]);
    await client.query('DELETE FROM libro_generos WHERE libro_isbn = $1', [isbn]);
    await client.query('DELETE FROM libro_conceptos WHERE libro_isbn = $1', [isbn]);

    await insertarRelaciones(client, isbn, autorIds, generoIds, conceptos);
  });
}

async function insertarRelaciones(client, isbn, autorIds, generoIds, conceptos) {
  for (const autorId of autorIds) {
    await client.query(
      'INSERT INTO libro_autores (libro_isbn, autor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [isbn, autorId]
    );
  }
  for (const generoId of generoIds) {
    await client.query(
      'INSERT INTO libro_generos (libro_isbn, genero_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [isbn, generoId]
    );
  }
  for (const { conceptoId, definicion } of conceptos) {
    await client.query(
      `INSERT INTO libro_conceptos (libro_isbn, concepto_id, definicion) VALUES ($1, $2, $3)
       ON CONFLICT (libro_isbn, concepto_id) DO UPDATE SET definicion = EXCLUDED.definicion`,
      [isbn, conceptoId, definicion]
    );
  }
}

/** Elimina el libro (las tablas hijas se limpian por ON DELETE CASCADE). */
async function eliminar(isbn) {
  await query('DELETE FROM libros WHERE isbn = $1', [isbn]);
}

// ---------------------------------------------------------------------
// Imagenes
// ---------------------------------------------------------------------

async function agregarImagenes(isbn, archivos) {
  const { rows: existentes } = await query(
    'SELECT COUNT(*)::int AS total FROM libro_imagenes WHERE libro_isbn = $1',
    [isbn]
  );
  let hayPortada = existentes[0].total > 0;
  const { rows: portadaExistente } = await query(
    'SELECT 1 FROM libro_imagenes WHERE libro_isbn = $1 AND es_portada = true',
    [isbn]
  );
  hayPortada = portadaExistente.length > 0;

  for (const [indice, archivo] of archivos.entries()) {
    const rutaRelativa = `/uploads/libros/${archivo.filename}`;
    const esPortada = !hayPortada && indice === 0;
    await query(
      `INSERT INTO libro_imagenes (libro_isbn, ruta_archivo, texto_alt, es_portada, orden)
       VALUES ($1, $2, $3, $4, $5)`,
      [isbn, rutaRelativa, archivo.originalname, esPortada, indice]
    );
    if (esPortada) hayPortada = true;
  }
}

async function buscarImagen(idImagen) {
  const { rows } = await query('SELECT * FROM libro_imagenes WHERE id = $1', [idImagen]);
  return rows[0] || null;
}

async function eliminarImagen(idImagen) {
  await query('DELETE FROM libro_imagenes WHERE id = $1', [idImagen]);
}

async function marcarPortada(isbn, idImagen) {
  return transaccion(async (client) => {
    await client.query('UPDATE libro_imagenes SET es_portada = false WHERE libro_isbn = $1', [isbn]);
    await client.query('UPDATE libro_imagenes SET es_portada = true WHERE id = $1 AND libro_isbn = $2', [
      idImagen,
      isbn,
    ]);
  });
}

module.exports = {
  listar,
  buscarPorIsbn,
  existeIsbn,
  crear,
  actualizar,
  eliminar,
  agregarImagenes,
  buscarImagen,
  eliminarImagen,
  marcarPortada,
};
