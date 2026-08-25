-- =====================================================================
-- Datos iniciales (opcional) para catálogos independientes.
-- El usuario administrador NO se siembra aquí: la aplicación promueve
-- automáticamente a "administrador" al primer usuario que se registre
-- (ver src/modules/auth/auth.model.js), respetando la restricción de
-- que exista como máximo un administrador.
-- =====================================================================

INSERT INTO formatos (nombre) VALUES
    ('Tapa dura'),
    ('Tapa blanda'),
    ('Digital (ebook)'),
    ('Audiolibro')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categorias (nombre) VALUES
    ('Ficción'),
    ('No ficción'),
    ('Infantil y juvenil'),
    ('Académico'),
    ('Cómic e ilustrado')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO generos (nombre) VALUES
    ('Novela'),
    ('Ciencia ficción'),
    ('Fantasía'),
    ('Historia'),
    ('Biografía'),
    ('Terror'),
    ('Poesía'),
    ('Ensayo')
ON CONFLICT (nombre) DO NOTHING;
