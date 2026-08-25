-- =====================================================================
-- Esquema de base de datos - Librería en línea
-- Motor: PostgreSQL 13+
-- Aplicación: Monolito Node.js con acceso directo a PostgreSQL (sin ORM)
--
-- Justificación de normalización (resumen):
--   Atributos de partida: ISBN, título, autor, año de publicación, género,
--   precio, stock, formato, imágenes, conceptos definidos por libro.
--
--   Dependencias funcionales identificadas sobre libros (clave = isbn):
--       isbn -> titulo, anio_publicacion, precio, stock, formato_id, categoria_id
--   Dependencias multivaluadas identificadas (isbn ->> X):
--       isbn ->> autor        (un libro tiene varios autores)
--       isbn ->> genero       (un libro pertenece a varios géneros)
--       isbn ->> imagen       (un libro tiene varias imágenes)
--       isbn ->> (concepto, definicion) (un libro define varios conceptos,
--                 y la definición depende del PAR libro-concepto, no solo
--                 del concepto: un mismo concepto puede tener definiciones
--                 distintas en libros distintos)
--
--   Para eliminar las dependencias multivaluadas (4FN) cada una se separa
--   en su propia relación N:M, y la definición de concepto se modela como
--   atributo de la relación libro-concepto (no del concepto en sí mismo,
--   ni del libro en sí mismo), evitando anomalías de inserción/borrado.
--
--   "Formato" y "Categoría" son catálogos independientes entre sí y
--   respecto de "Género" (que es multivaluado): cada uno vive en su propia
--   tabla catálogo con su propia clave primaria.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Limpieza (permite re-ejecutar el script en un entorno de desarrollo)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS libro_conceptos     CASCADE;
DROP TABLE IF EXISTS libro_generos       CASCADE;
DROP TABLE IF EXISTS libro_autores       CASCADE;
DROP TABLE IF EXISTS libro_imagenes      CASCADE;
DROP TABLE IF EXISTS libros              CASCADE;
DROP TABLE IF EXISTS conceptos           CASCADE;
DROP TABLE IF EXISTS autores             CASCADE;
DROP TABLE IF EXISTS generos             CASCADE;
DROP TABLE IF EXISTS categorias          CASCADE;
DROP TABLE IF EXISTS formatos            CASCADE;
DROP TABLE IF EXISTS usuarios            CASCADE;

-- ---------------------------------------------------------------------
-- USUARIOS registrados (clientes y administrador)
-- Restricción de negocio: debe existir como máximo un administrador.
-- Se aplica con un índice único parcial (no se puede insertar una
-- segunda fila con rol = 'administrador').
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150)  NOT NULL,
    email           VARCHAR(150)  NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    rol             VARCHAR(20)   NOT NULL DEFAULT 'cliente'
                        CHECK (rol IN ('cliente', 'administrador')),
    activo          BOOLEAN       NOT NULL DEFAULT true,
    fecha_registro  TIMESTAMP     NOT NULL DEFAULT now(),
    CONSTRAINT ux_usuarios_email UNIQUE (email)
);

-- Como máximo un administrador en todo el sistema.
CREATE UNIQUE INDEX ux_usuarios_un_solo_administrador
    ON usuarios (rol)
    WHERE rol = 'administrador';

-- Nota sobre sesiones HTTP: la sesion de navegador (quien esta
-- autenticado en cada peticion) se maneja en memoria del proceso
-- Node.js mediante express-session (ver src/app.js). No se modela como
-- tabla porque es un mecanismo de la capa HTTP, no parte del modelo de
-- datos normalizado del negocio (usuarios, libros, etc.).

-- ---------------------------------------------------------------------
-- Catálogos independientes: FORMATOS y CATEGORIAS
-- (cada libro tiene exactamente un formato y una categoría)
-- ---------------------------------------------------------------------
CREATE TABLE formatos (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(50) NOT NULL,
    CONSTRAINT ux_formatos_nombre UNIQUE (nombre)
);

CREATE TABLE categorias (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL,
    CONSTRAINT ux_categorias_nombre UNIQUE (nombre)
);

-- ---------------------------------------------------------------------
-- GENERO (catálogo multivaluado: un libro puede tener varios géneros)
-- ---------------------------------------------------------------------
CREATE TABLE generos (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL,
    CONSTRAINT ux_generos_nombre UNIQUE (nombre)
);

-- ---------------------------------------------------------------------
-- AUTORES (un libro puede tener varios autores; un autor puede aparecer
-- en varios libros -> relación N:M)
-- ---------------------------------------------------------------------
CREATE TABLE autores (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    biografia   TEXT
);
CREATE INDEX ix_autores_nombre ON autores (nombre);

-- ---------------------------------------------------------------------
-- CONCEPTOS (catálogo de conceptos; la definición vive en la relación
-- libro_conceptos porque depende del PAR libro-concepto)
-- ---------------------------------------------------------------------
CREATE TABLE conceptos (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(150) NOT NULL,
    CONSTRAINT ux_conceptos_nombre UNIQUE (nombre)
);

-- ---------------------------------------------------------------------
-- LIBROS (entidad principal). isbn -> titulo, anio, precio, stock,
-- formato_id, categoria_id  (dependencia funcional simple sobre la clave)
-- ---------------------------------------------------------------------
CREATE TABLE libros (
    isbn                  VARCHAR(20)   PRIMARY KEY,
    titulo                VARCHAR(255)  NOT NULL,
    anio_publicacion      SMALLINT      NOT NULL
        CHECK (anio_publicacion BETWEEN 1450 AND 2100),
    precio                NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock                 INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    formato_id            INTEGER       NOT NULL REFERENCES formatos(id),
    categoria_id          INTEGER       NOT NULL REFERENCES categorias(id),
    descripcion           TEXT,
    fecha_creacion        TIMESTAMP     NOT NULL DEFAULT now(),
    fecha_actualizacion   TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX ix_libros_titulo ON libros (titulo);
CREATE INDEX ix_libros_formato ON libros (formato_id);
CREATE INDEX ix_libros_categoria ON libros (categoria_id);

-- Mantiene fecha_actualizacion sincronizada en cada UPDATE de libros.
CREATE OR REPLACE FUNCTION fn_actualizar_fecha_libro()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_libros_actualizar_fecha
    BEFORE UPDATE ON libros
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_fecha_libro();

-- ---------------------------------------------------------------------
-- LIBRO_AUTORES  (N:M) -- resuelve isbn ->> autor
-- ---------------------------------------------------------------------
CREATE TABLE libro_autores (
    libro_isbn  VARCHAR(20) NOT NULL REFERENCES libros(isbn)  ON DELETE CASCADE,
    autor_id    INTEGER     NOT NULL REFERENCES autores(id)   ON DELETE CASCADE,
    PRIMARY KEY (libro_isbn, autor_id)
);
CREATE INDEX ix_libro_autores_autor ON libro_autores (autor_id);

-- ---------------------------------------------------------------------
-- LIBRO_GENEROS (N:M) -- resuelve isbn ->> genero
-- ---------------------------------------------------------------------
CREATE TABLE libro_generos (
    libro_isbn  VARCHAR(20) NOT NULL REFERENCES libros(isbn)  ON DELETE CASCADE,
    genero_id   INTEGER     NOT NULL REFERENCES generos(id)   ON DELETE CASCADE,
    PRIMARY KEY (libro_isbn, genero_id)
);
CREATE INDEX ix_libro_generos_genero ON libro_generos (genero_id);

-- ---------------------------------------------------------------------
-- LIBRO_CONCEPTOS (N:M con atributo) -- resuelve isbn ->> (concepto, def.)
-- (libro_isbn, concepto_id) -> definicion   (dependencia funcional sobre
-- la relación completa: la definición depende del PAR, no de una parte)
-- ---------------------------------------------------------------------
CREATE TABLE libro_conceptos (
    libro_isbn   VARCHAR(20) NOT NULL REFERENCES libros(isbn)    ON DELETE CASCADE,
    concepto_id  INTEGER     NOT NULL REFERENCES conceptos(id)   ON DELETE CASCADE,
    definicion   TEXT        NOT NULL,
    PRIMARY KEY (libro_isbn, concepto_id)
);
CREATE INDEX ix_libro_conceptos_concepto ON libro_conceptos (concepto_id);

-- ---------------------------------------------------------------------
-- LIBRO_IMAGENES (1:N) -- resuelve isbn ->> imagen (entidad débil)
-- ---------------------------------------------------------------------
CREATE TABLE libro_imagenes (
    id             SERIAL PRIMARY KEY,
    libro_isbn     VARCHAR(20)  NOT NULL REFERENCES libros(isbn) ON DELETE CASCADE,
    ruta_archivo   VARCHAR(500) NOT NULL,
    texto_alt      VARCHAR(255),
    es_portada     BOOLEAN      NOT NULL DEFAULT false,
    orden          SMALLINT     NOT NULL DEFAULT 0,
    fecha_subida   TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_libro_imagenes_libro ON libro_imagenes (libro_isbn);

-- Como máximo una imagen "portada" por libro.
CREATE UNIQUE INDEX ux_libro_imagenes_una_portada
    ON libro_imagenes (libro_isbn)
    WHERE es_portada = true;

-- =====================================================================
-- Fin del esquema
-- =====================================================================
