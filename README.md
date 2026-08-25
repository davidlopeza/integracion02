# Librería en línea — aplicación monolítica Node.js + PostgreSQL

Aplicación web monolítica en Node.js que gestiona una librería en línea con
acceso **directo** a PostgreSQL (sin ORM), renderizado de HTML en el
servidor (EJS), organización por módulos y patrón MVC dentro de cada
módulo. No expone API REST, GraphQL ni SOAP, y no intercambia datos en
JSON ni XML: toda la interacción ocurre mediante formularios HTML
tradicionales (`application/x-www-form-urlencoded` y
`multipart/form-data` para imágenes). El archivo `package.json` existe
únicamente porque `npm` lo requiere para administrar las dependencias.

## 1. Arquitectura y modelo de datos

- **Macro-arquitectura:** monolito (un solo proceso Node.js, una sola base
  de datos).
- **Patrón GUI:** MVC dentro de cada módulo — `*.routes.js` (controlador de
  entrada HTTP) → `*.controller.js` (lógica de aplicación) →
  `*.model.js` (acceso a datos con SQL parametrizado) → `views/*.ejs`
  (vista renderizada en servidor).
- **Organización de código:** por módulos de negocio en
  `src/modules/{auth,usuarios,libros,autores,generos,categorias,formatos,conceptos}`.
- **Esquema normalizado:** ver [`data/db_schema.sql`](data/db_schema.sql).
  Resumen de dependencias funcionales y multivaluadas identificadas a
  partir de (ISBN, título, autor, año, género, precio, stock, formato,
  imágenes, conceptos):
  - `isbn -> titulo, anio_publicacion, precio, stock, formato_id, categoria_id`
  - `isbn ->> autor` (N:M vía `libro_autores`)
  - `isbn ->> genero` (N:M vía `libro_generos`)
  - `isbn ->> imagen` (1:N vía `libro_imagenes`)
  - `isbn ->> (concepto, definicion)` (N:M con atributo vía
    `libro_conceptos`; la definición depende del **par** libro-concepto,
    por eso un mismo concepto puede tener definiciones distintas en
    libros distintos)
  - `formatos` y `categorias` son catálogos independientes entre sí y
    respecto de `generos`.
  - La tabla `usuarios` tiene un índice único parcial que garantiza que
    exista **como máximo un administrador**; el primer usuario que se
    registra en la aplicación se promueve automáticamente a
    administrador (no hay una pantalla para "hacerse admin").

## 2. Requisitos previos en el servidor (CentOS Stream 10)

Estas instrucciones asumen que **PostgreSQL ya está instalado y en
ejecución**, con:

- Usuario de base de datos: `library_user`
- Contraseña: `library666`
- Base de datos: `library_db`

Y que ese usuario tiene privilegios suficientes sobre `library_db`
(dueño de la base o con `GRANT ALL PRIVILEGES ON DATABASE library_db TO library_user;`).

### 2.1. Instalar Node.js (LTS) y git

CentOS Stream 10 no trae Node.js en el repositorio base con la versión
necesaria (>= 18), así que se instala desde el repositorio de NodeSource:

```bash
sudo dnf install -y curl git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v      # debe mostrar v20.x o superior
npm -v
```

### 2.2. Crear un usuario de sistema para la aplicación (recomendado)

```bash
sudo useradd -r -m -d /opt/libreria -s /sbin/nologin libreria
sudo mkdir -p /opt/libreria/app
sudo chown -R libreria:libreria /opt/libreria
```

## 3. Obtener el código en el servidor

Copia el proyecto a `/opt/libreria/app` (por ejemplo, con `scp`, `git
clone` desde tu propio repositorio, o `rsync`). El resultado debe ser
que `/opt/libreria/app/package.json` exista.

```bash
# Ejemplo si el código se sube por scp desde tu máquina:
#   scp -r ./IntegracionProject usuario@servidor:/tmp/libreria
sudo mv /tmp/libreria/* /opt/libreria/app/
sudo chown -R libreria:libreria /opt/libreria/app
```

## 4. Instalar dependencias de Node.js

```bash
cd /opt/libreria/app
sudo -u libreria npm install --omit=dev
```

## 5. Configurar variables de entorno

```bash
sudo -u libreria cp .env.example .env
sudo -u libreria nano .env
```

Contenido recomendado de `.env` para este servidor:

```ini
PORT=3000
NODE_ENV=production
SESSION_SECRET=<genera-una-cadena-larga-y-aleatoria-aqui>

PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=library_db
PGUSER=library_user
PGPASSWORD=library666

UPLOAD_MAX_BYTES=5242880
```

Para generar un `SESSION_SECRET` aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 6. Crear el esquema en PostgreSQL

Con PostgreSQL ya instalado y `library_db`/`library_user` ya creados,
ejecuta el script de esquema (y opcionalmente el de datos semilla de
catálogos):

```bash
psql "host=127.0.0.1 port=5432 dbname=library_db user=library_user password=library666" \
     -f /opt/libreria/app/data/db_schema.sql

# Opcional: catálogos iniciales de formatos/categorías/géneros
psql "host=127.0.0.1 port=5432 dbname=library_db user=library_user password=library666" \
     -f /opt/libreria/app/data/seed.sql
```

Si `psql` no está instalado en el servidor de aplicación (por ejemplo
porque PostgreSQL corre en otra máquina), instala solo el cliente:

```bash
sudo dnf install -y postgresql
```

> El primer usuario que se registre desde la aplicación (`/auth/registro`)
> quedará automáticamente como **administrador**. No hay ninguna cuenta
> administradora precargada en el esquema.

## 7. Carpeta de imágenes subidas

Las imágenes de portada/galería de cada libro se guardan como archivos
en `public/uploads/libros`. Verifica que el usuario de sistema pueda
escribir ahí:

```bash
sudo mkdir -p /opt/libreria/app/public/uploads/libros
sudo chown -R libreria:libreria /opt/libreria/app/public/uploads
```

## 8. Probar la aplicación manualmente

```bash
cd /opt/libreria/app
sudo -u libreria NODE_ENV=production node server.js
```

Deberías ver `Libreria en linea escuchando en http://localhost:3000
(entorno: production)`. Prueba desde el propio servidor:

```bash
curl -I http://localhost:3000
```

Detén la prueba con `Ctrl+C` antes de continuar con el paso de systemd.

## 9. Ejecutar como servicio con systemd

Crea `/etc/systemd/system/libreria.service`:

```ini
[Unit]
Description=Libreria en linea (Node.js monolito)
After=network.target postgresql.service

[Service]
Type=simple
User=libreria
Group=libreria
WorkingDirectory=/opt/libreria/app
EnvironmentFile=/opt/libreria/app/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
# Endurecimiento básico
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Habilita e inicia el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now libreria.service
sudo systemctl status libreria.service
```

Ver logs en vivo:

```bash
sudo journalctl -u libreria.service -f
```

## 10. Firewall y SELinux (CentOS Stream 10)

Si accederás directamente al puerto 3000 desde fuera del servidor:

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

CentOS Stream 10 trae **SELinux en modo enforcing** por defecto. Si
usas un puerto no estándar (como 3000) directamente, SELinux no suele
bloquear a Node.js porque no es un servicio "confinado" como httpd;
si en `journalctl`/`audit.log` aparecen bloqueos (`AVC denied`), revisa
con:

```bash
sudo ausearch -m avc -ts recent
```

y crea la excepción puntual que indique `audit2allow`, por ejemplo:

```bash
sudo ausearch -m avc -ts recent | audit2allow -M libreria_local
sudo semodule -i libreria_local.pp
```

## 11. (Opcional) Nginx como proxy inverso en el puerto 80/443

Si prefieres exponer la aplicación en el puerto 80/443 en vez del 3000
directo:

```bash
sudo dnf install -y nginx
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
# Permite que nginx (confinado por SELinux) abra conexiones salientes
# hacia el backend Node.js:
sudo setsebool -P httpd_can_network_connect 1
```

Archivo `/etc/nginx/conf.d/libreria.conf`:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo systemctl enable --now nginx
sudo nginx -t && sudo systemctl reload nginx
```

Con nginx al frente, el puerto 3000 puede cerrarse al exterior
(`firewall-cmd --permanent --remove-port=3000/tcp`) dejando solo 80/443
abiertos.

## 12. Actualizar la aplicación (despliegues posteriores)

```bash
sudo systemctl stop libreria.service
cd /opt/libreria/app
# ... reemplazar el código por la nueva versión ...
sudo -u libreria npm install --omit=dev
sudo systemctl start libreria.service
```

Si una actualización agrega tablas/columnas nuevas, aplica el script
de migración correspondiente con `psql` antes de reiniciar el
servicio (este proyecto usa `data/db_schema.sql` como fuente de verdad
del esquema; para bases ya en producción crea migraciones incrementales
en vez de volver a ejecutar el script completo, que empieza con
`DROP TABLE`).

## 13. Estructura del proyecto

```
IntegracionProject/
├── data/
│   ├── db_schema.sql      # Esquema PostgreSQL normalizado
│   └── seed.sql           # Catálogos iniciales (opcional)
├── public/
│   ├── css/styles.css
│   └── uploads/libros/    # Imágenes subidas (contenido, no en git)
├── src/
│   ├── app.js             # Ensamblado de Express (middlewares, rutas)
│   ├── config/
│   │   ├── db.js          # Pool de conexión PostgreSQL (pg)
│   │   └── env.js         # Lectura centralizada de variables de entorno
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── upload.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── modules/
│   │   ├── auth/           # Registro, login, logout
│   │   ├── usuarios/       # Administración de usuarios registrados
│   │   ├── libros/         # CRUD de libros + relaciones N:M + imágenes
│   │   ├── autores/        # CRUD catálogo de autores
│   │   ├── generos/        # CRUD catálogo de géneros
│   │   ├── categorias/     # CRUD catálogo de categorías
│   │   ├── formatos/       # CRUD catálogo de formatos
│   │   └── conceptos/      # CRUD catálogo de conceptos
│   ├── shared/
│   │   └── catalogoModel.js  # Fábrica de acceso a datos para catálogos simples
│   └── views/               # Vistas EJS (layout + una carpeta por módulo)
├── server.js               # Punto de entrada del proceso Node.js
├── package.json
└── .env.example
```

## 14. Notas de diseño relevantes para la evaluación

- **Sin API/JSON/XML:** no existen rutas que devuelvan `application/json`
  ni `application/xml`; todas las respuestas son HTML renderizado con
  EJS. Los formularios usan `_method` (paquete `method-override`) para
  simular `PUT`/`DELETE` desde HTML puro.
- **Acceso directo a PostgreSQL:** todo el acceso a datos usa el driver
  `pg` con SQL parametrizado (sin ORM). Las operaciones que tocan varias
  tablas relacionadas (crear/editar un libro con sus autores, géneros y
  conceptos) se ejecutan dentro de una transacción (`BEGIN`/`COMMIT`/
  `ROLLBACK`) en `src/config/db.js`.
- **Imágenes:** se reciben como `multipart/form-data` (con `multer`), se
  guardan como archivos en `public/uploads/libros` y en la base de
  datos solo se guarda la ruta del archivo (tabla `libro_imagenes`).
- **Administrador único:** aplicado en dos capas — a nivel de base de
  datos (índice único parcial `ux_usuarios_un_solo_administrador`) y a
  nivel de aplicación (el primer registro se promueve automáticamente).
