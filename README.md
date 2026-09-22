# Inventario LICC

Sistema de inventario de laboratorio con sincronización en tiempo real entre
dispositivos usando Firebase Firestore.

---

## Problemas resueltos

### 1. Un producto creado no aparecía al buscarlo

**Causa:** en `script.js`, dentro de `renderTables()`, había un **segundo
filtrado** que leía los campos `#search-input` / `#inputBusqueda` y
`#category-filter` / `#selectCategoria` — IDs que **no existen** en el HTML (los
reales son `#search-student` y `#search-admin`). Ese filtro fantasma alteraba la
lista que ya venía filtrada desde `filterProducts()`, por lo que el buscador
podía no mostrar resultados.

**Solución:** se eliminó ese filtrado duplicado. Ahora **solo** `filterProducts()`
decide qué se muestra, y `renderTables()` se limita a pintar lo que recibe.

### 2. Un producto agregado no aparecía en la otra máquina

Varias causas combinadas:

- **`firebase.analytics()` podía lanzar una excepción** al inicializar (por
  `file://`, dominio no autorizado, bloqueo de red o adblock). Esa excepción
  cortaba `firebase-config.js` **antes** de definir `window.firebaseReady` y los
  helpers de Firestore → la app quedaba en modo "solo localStorage" y **nunca
  sincronizaba**. Ahora analytics es opcional (envuelto en `try/catch`).
- **Doble listener de Firestore:** `DOMContentLoaded` registraba uno y
  `app.init()` otro, y el primero sobrescribía `app.products` con datos sin
  normalizar. Ahora solo hay **un** listener (el de `app.init()`).
- **`saveData()` subía TODO el inventario local en cada guardado**, de modo que
  una máquina con datos desfasados **sobrescribía en Firestore los cambios
  recientes de la otra** (haciendo "desaparecer" productos). Ahora se sube
  **solo el producto afectado**.
- **IDs colisionaban:** se usaba `Math.max(id)+1`, que podía coincidir con un
  producto creado en otra máquina y sobrescribirlo. Ahora el ID de un producto
  nuevo se basa en el timestamp (único entre dispositivos).
- **Reglas de Firestore:** si las reglas deniegan lectura/escritura, la app se
  guarda solo en el dispositivo. Ver la sección *Configurar Firestore*.

---

## Cómo ejecutar

### Requisitos
- Node.js instalado (para el servidor local).

### Iniciar el servidor

```powershell
npm start
```

Aparecerá algo como:

```
En esta PC:      http://localhost:5500
En el celular:   http://192.168.1.50:5500
```

### En el celular
1. Conéctate a la **misma red WiFi** que la PC.
2. Abre en el navegador la dirección `http://<TU-IP>:5500`.
3. Verás abajo a la izquierda un indicador de sincronización:
   - 🟢 **Sincronizado (N productos)** → conectado a la nube.
   - 🟠 **Sin conexión (modo local)** → los cambios NO se comparten.
   - 🔴 **Sin permiso de Firestore** → hay que corregir las reglas.

> ⚠️ **No abras `index.html` con doble clic (`file://`)**: el navegador bloquea
> la red y Firebase no funcionará. Siempre por `http://`.

---

## Configurar Firestore (reglas)

Si el indicador muestra error de permisos:

1. Entra a [Firebase Console](https://console.firebase.google.com) →
   proyecto **inventario-de-licc**.
2. **Firestore Database → Reglas**.
3. Pega el contenido de `firestore.rules` y **Publica**.

---

## Archivos principales

| Archivo | Rol |
|---|---|
| `index.html` | Interfaz y carga de scripts |
| `script.js` | Lógica de la app (CRUD, búsqueda, sincronización) |
| `firebase-config.js` | Conexión a Firestore y helpers |
| `data.js` | Inventario inicial por defecto |
| `server.js` | Servidor local para probar desde el celular |
| `firestore.rules` | Reglas de seguridad de Firestore |