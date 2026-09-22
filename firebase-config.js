// ============================================================
// firebase-config.js  -  Configuracion de Firebase para LICC
// Usa la version CDN (compat) para funcionar sin bundler
// ============================================================

// Este archivo se carga DESPUES de los scripts de Firebase CDN
// definidos en index.html (firebase-app-compat, firestore-compat, analytics-compat)

const firebaseConfig = {
    apiKey:            "AIzaSyCCqcsrSMyJ5f7yw7ObNx99NQcfJg68_No",
    authDomain:        "inventario-de-licc.firebaseapp.com",
    projectId:         "inventario-de-licc",
    storageBucket:     "inventario-de-licc.firebasestorage.app",
    messagingSenderId: "202585092234",
    appId:             "1:202585092234:web:9eea2115b06d880f3b7d73",
    measurementId:     "G-B1YQ6WBHLD"
};

// Bandera global: la app la consulta para decidir si sincroniza con Firestore.
// Se declara ANTES de cualquier cosa que pueda fallar, para que siempre exista.
window.firebaseReady = false;

// Inicializar Firebase (usando la API compat global: firebase.xxx)
let firebaseApp = null;
let db = null;
try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    db          = firebase.firestore();
} catch (e) {
    console.error('[Firebase] ❌ No se pudo inicializar Firebase/Firestore:', e && e.message);
    console.error('[Firebase] La app funcionara en modo local (localStorage) sin sincronizacion.');
}

// Analytics es OPCIONAL. Si falla (file://, dominio no autorizado, bloqueo de
// red, adblock), NO debe romper la carga de la app: si esta linea lanzaba una
// excepcion, se detenia el script antes de definir window.firebaseReady y los
// helpers de Firestore, y la app quedaba en modo "solo localStorage" (los
// productos nunca se sincronizaban con la otra maquina).
let analytics = null;
try {
    if (typeof firebase.analytics === 'function') {
        analytics = firebase.analytics();
    }
} catch (e) {
    console.warn('[Firebase] Analytics no disponible (no es critico):', e && e.message);
}

// ──────────────────────────────────────────────────────────
// Helpers globales para usar Firestore desde script.js
// ──────────────────────────────────────────────────────────

async function guardarProductoFirebase(product) {
    if (!db) {
        console.warn('[Firebase] Firestore no esta disponible. Guardado ignorado.');
        return null;
    }
    try {
        const docRef = product.id
            ? db.collection('productos').doc(String(product.id))
            : db.collection('productos').doc();

        console.log('[Firebase] Intentando guardar producto:', product.name || product.nombre, 'ID:', docRef.id);
        await docRef.set({
            ...product,
            _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('[Firebase] ✅ Producto guardado exitosamente:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('[Firebase] ❌ Error al guardar producto:', error);
        console.error('[Firebase] Detalles del error:', error.code, error.message);
        throw error;
    }
}

async function eliminarProductoFirebase(productId) {
    if (!db) {
        console.warn('[Firebase] Firestore no esta disponible. Eliminacion ignorada.');
        return null;
    }
    try {
        await db.collection('productos').doc(String(productId)).delete();
        console.log('[Firebase] Producto eliminado:', productId);
    } catch (error) {
        console.error('[Firebase] Error al eliminar producto:', error);
        throw error;
    }
}

async function cargarProductosFirebase() {
    if (!db) {
        return [];
    }
    try {
        const snapshot = await db.collection('productos').get();
        const productos = [];
        snapshot.forEach(doc => {
            productos.push({ id: doc.id, ...doc.data() });
        });
        console.log('[Firebase] Productos cargados:', productos.length);
        return productos;
    } catch (error) {
        console.error('[Firebase] Error al cargar productos:', error);
        throw error;
    }
}

function escucharProductosFirebase(callback) {
    if (!db) {
        console.warn('[Firebase] Firestore no esta disponible. Sin listener en tiempo real.');
        return function () { };
    }
    console.log('[Firebase] 🎧 Iniciando listener en tiempo real para productos...');
    return db.collection('productos').onSnapshot(snapshot => {
        console.log('[Firebase] 📡 Snapshot recibido - Cambios detectados:', snapshot.docs.length, 'documentos');
        const productos = [];
        snapshot.forEach(doc => {
            productos.push({ id: doc.id, ...doc.data() });
        });
        console.log('[Firebase] 🔄 Llamando callback con', productos.length, 'productos');
        callback(productos);
    }, error => {
        console.error('[Firebase] ❌ Error en listener:', error);
        console.error('[Firebase] Detalles del error:', error.code, error.message);
        if (typeof setSyncStatus === 'function') {
            const msg = error.code === 'permission-denied'
                ? 'Sin permiso de Firestore (revisa las reglas)'
                : 'Error de conexion con la nube';
            setSyncStatus('error', msg);
        }
        // Intentar reconectar automáticamente después de 5 segundos
        console.log('[Firebase] 🔄 Intentando reconectar en 5 segundos...');
        setTimeout(() => {
            console.log('[Firebase] 🔄 Reconectando listener...');
            escucharProductosFirebase(callback);
        }, 5000);
    });
}

// Solo marcar listo si Firestore se inicializo de verdad.
if (db) {
    window.firebaseReady = true;
}
console.log('[Firebase] ' + (window.firebaseReady ? '✅' : '⚠️') + ' Estado Firestore - ready:', window.firebaseReady, '- Proyecto:', firebaseConfig.projectId);
console.log('[Firebase] ✅ Funciones disponibles:', {
    guardarProductoFirebase: typeof guardarProductoFirebase,
    cargarProductosFirebase: typeof cargarProductosFirebase,
    escucharProductosFirebase: typeof escucharProductosFirebase
});
