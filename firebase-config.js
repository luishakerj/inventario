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

// Inicializar Firebase (usando la API compat global: firebase.xxx)
const firebaseApp  = firebase.initializeApp(firebaseConfig);
const db           = firebase.firestore();
const analytics    = firebase.analytics();

// ──────────────────────────────────────────────────────────
// Helpers globales para usar Firestore desde script.js
// ──────────────────────────────────────────────────────────

async function guardarProductoFirebase(product) {
    try {
        const docRef = product.id
            ? db.collection('productos').doc(String(product.id))
            : db.collection('productos').doc();

        await docRef.set({
            ...product,
            _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('[Firebase] Producto guardado:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('[Firebase] Error al guardar producto:', error);
        throw error;
    }
}

async function eliminarProductoFirebase(productId) {
    try {
        await db.collection('productos').doc(String(productId)).delete();
        console.log('[Firebase] Producto eliminado:', productId);
    } catch (error) {
        console.error('[Firebase] Error al eliminar producto:', error);
        throw error;
    }
}

async function cargarProductosFirebase() {
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
    return db.collection('productos').onSnapshot(snapshot => {
        const productos = [];
        snapshot.forEach(doc => {
            productos.push({ id: doc.id, ...doc.data() });
        });
        callback(productos);
    }, error => {
        console.error('[Firebase] Error en listener:', error);
    });
}

window.firebaseReady = true;
console.log('[Firebase] Inicializado correctamente - Proyecto:', firebaseConfig.projectId);
