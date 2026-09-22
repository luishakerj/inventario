// ============================================================
// server.js  -  Servidor local para el Inventario LICC
// ============================================================
// Sirve la carpeta del proyecto por HTTP para que puedas abrir la app
// desde el navegador del celular en la MISMA red WiFi que esta PC.
//
// Uso:
//   npm start          (o:  node server.js)
//
// Luego, en el celular, abre la direccion que aparece como
// "http://<TU-IP-LOCAL>:5500" en el navegador.
//
// IMPORTANTE: abrir el index.html con doble clic (file://) NO sirve para
// probar la sincronizacion, porque el navegador bloquea la red y Firebase
// no puede conectar. Debe abrirse por http://
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
    // Quitar query string (ej. "script.js?v=2026_v6")
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // Evitar salir de la carpeta del proyecto (path traversal)
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Acceso denegado');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('No encontrado: ' + urlPath);
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }

    console.log('');
    console.log('  Inventario LICC - servidor iniciado');
    console.log('  ------------------------------------------------');
    console.log('  En esta PC:      http://localhost:' + PORT);
    if (ips.length) {
        ips.forEach(ip => {
            console.log('  En el celular:   http://' + ip + ':' + PORT);
        });
    } else {
        console.log('  (No se detecto IP de red. Conectate a una red WiFi.)');
    }
    console.log('  ------------------------------------------------');
    console.log('  El celular debe estar en la MISMA red WiFi.');
    console.log('  Presiona Ctrl+C para detener el servidor.');
    console.log('');
});