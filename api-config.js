// ============================================================
// api-config.js  -  Backend PHP + MySQL para el Inventario LICC
// ============================================================
// Reemplaza a firebase-config.js. Expone EXACTAMENTE las mismas
// funciones globales que la app ya usa, pero hablando con api.php
// en lugar de Firestore:
//
//   - cargarProductosFirebase()      -> GET api.php?action=listar
//   - guardarProductoFirebase(p)     -> POST api.php?action=guardar
//   - eliminarProductoFirebase(id)   -> POST api.php?action=eliminar
//   - escucharProductosFirebase(cb)  -> polling cada N segundos
//
// La app (script.js) no necesita cambios de logica: sigue llamando a
// estas mismas funciones y consultando window.firebaseReady.
// ============================================================

// Ruta al backend PHP. Si mueves api.php, cambia esto.
const API_BASE = 'api.php';

// Cada cuanto se pregunta al servidor por cambios (ms). 4 s es un
// buen equilibrio entre "casi en tiempo real" y carga del servidor.
const API_POLL_MS = 4000;

// Se mantiene el mismo nombre de bandera que la app consulta.
window.firebaseReady = false;

/**
 * Convierte el producto de la app al formato que espera api.php.
 * Quita campos internos (_pendienteDesde) que no deben persistir.
 */
function _prepararProductoParaApi(product) {
    const copia = { ...product };
    delete copia._pendienteDesde;
    if (copia.id !== undefined && copia.id !== null) {
        copia.id = String(copia.id);
    }
    return copia;
}

/**
 * Peticion generica al backend. Devuelve el JSON ya parseado.
 */
async function _apiFetch(action, opciones) {
    const url = API_BASE + '?action=' + encodeURIComponent(action);
    const res = await fetch(url, opciones || {});
    if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' al llamar a ' + url);
    }
    const data = await res.json();
    if (!data || data.ok !== true) {
        throw new Error((data && data.error) || 'Respuesta invalida del servidor');
    }
    return data;
}

// ------------------------------------------------------------
// Cargar todos los productos
// ------------------------------------------------------------
async function cargarProductosFirebase() {
    try {
        const data = await _apiFetch('listar');
        const productos = Array.isArray(data.productos) ? data.productos : [];
        console.log('[MySQL] Productos cargados:', productos.length);
        return productos;
    } catch (error) {
        console.error('[MySQL] Error al cargar productos:', error);
        throw error;
    }
}

// ------------------------------------------------------------
// Guardar UN producto (o una lista, si se pasa un arreglo)
// ------------------------------------------------------------
async function guardarProductoFirebase(product) {
    try {
        const enviarLista = Array.isArray(product);
        const body = enviarLista
            ? { productos: product.map(_prepararProductoParaApi) }
            : { producto: _prepararProductoParaApi(product) };

        const data = await _apiFetch('guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const id = enviarLista ? null : String(product.id);
        console.log('[MySQL] ✅ Producto(s) guardado(s):', data.guardados);
        return id;
    } catch (error) {
        console.error('[MySQL] ❌ Error al guardar producto:', error);
        throw error;
    }
}

// ------------------------------------------------------------
// Eliminar definitivamente un producto
// ------------------------------------------------------------
async function eliminarProductoFirebase(productId) {
    try {
        await _apiFetch('eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: String(productId) })
        });
        console.log('[MySQL] Producto eliminado:', productId);
    } catch (error) {
        console.error('[MySQL] Error al eliminar producto:', error);
        throw error;
    }
}

// ------------------------------------------------------------
// "Listener en tiempo real" mediante polling.
// Devuelve una funcion para detenerlo (misma firma que Firebase).
// ------------------------------------------------------------
function escucharProductosFirebase(callback) {
    let detenido = false;
    let ultimoHash = null;
    let fallos = 0;

    async function consultar() {
        if (detenido) return;
        try {
            const productos = await cargarProductosFirebase();
            // Solo avisar si algo cambio (evita re-render innecesario).
            const hash = JSON.stringify(productos);
            if (hash !== ultimoHash) {
                ultimoHash = hash;
                fallos = 0;
                if (typeof setSyncStatus === 'function') {
                    const activos = productos.filter(p => !p._enPapelera).length;
                    setSyncStatus('ok', 'Sincronizado (' + activos + ' productos)');
                }
                callback(productos);
            }
        } catch (error) {
            fallos++;
            console.error('[MySQL] ❌ Error en el sondeo (intento ' + fallos + '):', error);
            if (typeof setSyncStatus === 'function') {
                setSyncStatus('error', 'Sin conexion con el servidor');
            }
        }
    }

    // Primera consulta inmediata + sondeo periodico.
    consultar();
    const timer = setInterval(consultar, API_POLL_MS);

    console.log('[MySQL] 🎧 Sondeo en tiempo real iniciado cada', API_POLL_MS, 'ms');

    // Funcion para detener el sondeo.
    return function () {
        detenido = true;
        clearInterval(timer);
        console.log('[MySQL] 🛑 Sondeo detenido');
    };
}

// Comprobar que el backend responde antes de marcar "listo".
// Si no responde, la app cae en modo local (localStorage/data.js).
//
// NOTA: la app (script.js -> app.init) espera esta promesa antes de
// decidir entre modo MySQL o modo local, para evitar la carrera con
// DOMContentLoaded (la comprobacion es asincrona).
window.backendReadyPromise = (async function comprobarBackend() {
    try {
        await cargarProductosFirebase();
        window.firebaseReady = true;
        console.log('[MySQL] ✅ Backend listo -', API_BASE);
        return true;
    } catch (e) {
        window.firebaseReady = false;
        console.warn('[MySQL] ⚠️ Backend no disponible. La app funcionara en modo local:', e && e.message);
        return false;
    }
})();