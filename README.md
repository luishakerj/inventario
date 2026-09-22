# Inventario LICC

Sistema de inventario de laboratorio con sincronización entre dispositivos
usando un **backend propio en PHP + MySQL**. Cada PC/celular lee y escribe en la
misma base de datos, sin depender de servicios en la nube (Firebase) ni de sus
límites de uso.

> ⚠️ **Cambio importante:** este proyecto ya **no usa Firebase**. Ahora necesita
> un servidor con **Apache + PHP + MySQL** (por ejemplo, **XAMPP**). El antiguo
> `server.js` de Node servía solo archivos estáticos y **no ejecuta PHP**.

---

## Requisitos

- **XAMPP** (o WAMP / MAMP / LAMP) instalado. Aporta Apache, PHP y MySQL.
- Opcional: `npm`/`server.js` ya no son necesarios para la sincronización.

---

## Instalación paso a paso

### 1. Colocar el proyecto dentro de htdocs

Copia esta carpeta dentro de la carpeta `htdocs` de XAMPP, por ejemplo:

```
C:\xampp\htdocs\licc-inventario\
```

(La carpeta `htdocs` viene dentro del directorio donde instalaste XAMPP.)

### 2. Crear la base de datos

1. Enciende **Apache** y **MySQL** desde el Panel de Control de XAMPP.
2. Abre [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
3. Pestaña **Importar** → selecciona el archivo `db/schema.sql` → **Continuar**.

Esto crea la base `licc_inventario` y la tabla `productos`.

### 3. Configurar credenciales

Abre `config.php` y ajusta los datos de tu MySQL. Con XAMPP por defecto suelen
venir ya listos (usuario `root`, sin contraseña):

```php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'licc_inventario');
define('DB_USER', 'root');
define('DB_PASS', '');
```

### 4. Abrir la app

En el navegador de la PC:

```
http://localhost/licc-inventario/
```

### 5. Desde el celular

1. Conéctate a la **misma red WiFi** que la PC.
2. Abre `http://<TU-IP-LOCAL>/licc-inventario/` (por ejemplo
   `http://192.168.1.50/licc-inventario/`).
3. Verás abajo a la izquierda el indicador de sincronización:
   - 🟢 **Sincronizado (N productos)** → conectado al servidor MySQL.
   - 🟠 **Sin conexión (modo local)** → los cambios NO se comparten.
   - 🔴 **Sin conexión con el servidor** → revisa que XAMPP esté encendido.

> ⚠️ **No abras `index.html` con doble clic (`file://`)**: el navegador no
> ejecuta PHP ni permite llamar a `api.php`. Siempre por `http://`.

---

## Cómo funciona

| Archivo | Rol |
|---|---|
| `index.html` | Interfaz y carga de scripts |
| `script.js` | Lógica de la app (CRUD, búsqueda, sincronización) |
| `api-config.js` | Traduce las llamadas de la app a peticiones a `api.php` |
| `api.php` | Backend: recibe listar / guardar / eliminar |
| `config.php` | Credenciales de MySQL |
| `db/schema.sql` | Estructura de la base de datos |
| `data.js` | Inventario inicial por defecto |

- **Cargar:** la app pide a `api.php?action=listar` todos los productos.
- **Guardar:** `api.php?action=guardar` inserta o actualiza **solo el producto
  afectado** (no reescribe todo el inventario, para no pisar cambios de otros
  dispositivos).
- **Eliminar:** mover a papelera = guardar con la marca `_enPapelera`;
  borrado definitivo = `api.php?action=eliminar`.
- **Tiempo real:** la app pregunta al servidor cada 4 segundos
  (`API_POLL_MS` en `api-config.js`) y repinta si hubo cambios.

---

## Notas de seguridad y respaldo

- Al ser MySQL propio, **tú controlas los datos**: haz respaldos periódicos.
  Desde phpMyAdmin: selecciona `licc_inventario` → **Exportar** → Guardar archivo.
- Por simplicidad, la app **no tiene login de usuario**. Cualquiera que acceda a
  la URL puede leer y escribir. Si necesitas autenticación, indícalo para
  añadirla al backend (`api.php`).
- Si más adelante quieres exponerla a internet, hazlo tras una contraseña y con
  HTTPS para no dejar la base accesible públicamente.

---

## Historial de correcciones anteriores (Firestore)

Los siguientes problemas se resolvieron cuando el proyecto usaba Firebase; la
lógica equivalente se mantiene ahora con MySQL:

- Un producto creado no aparecía al buscarlo: se eliminó un filtrado duplicado
  en `renderTables()`.
- Un producto agregado no aparecía en otra máquina: se corrigieron el listener
  duplicado, la sobrescritura de todo el inventario en cada guardado, IDs
  colisionantes y las reglas de permisos.