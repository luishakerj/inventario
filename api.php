<?php
// ============================================================
// api.php  -  Backend del Inventario LICC (PHP + MySQL)
// ============================================================
// Reemplaza a Firebase Firestore. La app (script.js) sigue llamando
// a las mismas funciones globales (cargarProductosFirebase,
// guardarProductoFirebase, eliminarProductoFirebase,
// escucharProductosFirebase); solo cambia su implementacion,
// que ahora habla con este archivo.
//
// Endpoints (todos via POST JSON, o GET ?action=listar):
//   ?action=listar   -> devuelve todos los productos
//   ?action=guardar  -> inserta o actualiza UN producto (body: producto)
//   ?action=eliminar -> borra definitivamente (body: { id })
//
// Acciones de escritura aceptan tambien una lista:
//   ?action=guardar  -> body: { productos: [ ... ] }
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'listar';

// Leer el body JSON (si lo hay)
$body = [];
$raw  = file_get_contents('php://input');
if ($raw !== false && $raw !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

try {
    $pdo = conectar_db();
    switch ($action) {
        case 'listar':
            responder_lista($pdo);
            break;
        case 'guardar':
            responder_guardar($pdo, $body);
            break;
        case 'eliminar':
            responder_eliminar($pdo, $body);
            break;
        default:
            responder_error('Accion no reconocida: ' . $action, 400);
    }
} catch (Throwable $e) {
    responder_error('Error del servidor: ' . $e->getMessage(), 500);
}

// ------------------------------------------------------------
// LISTAR: devuelve todos los productos (activos y papelera)
// ------------------------------------------------------------
function responder_lista(PDO $pdo)
{
    $sql  = 'SELECT * FROM productos';
    $stmt = $pdo->query($sql);
    $filas = $stmt->fetchAll();

    $productos = array_map('fila_a_producto', $filas);
    responder_ok(['productos' => $productos]);
}

// ------------------------------------------------------------
// GUARDAR: acepta un producto suelto o una lista { productos: [...] }
// ------------------------------------------------------------
function responder_guardar(PDO $pdo, array $body)
{
    if (isset($body['productos']) && is_array($body['productos'])) {
        $lista = $body['productos'];
    } elseif (isset($body['producto']) && is_array($body['producto'])) {
        $lista = [$body['producto']];
    } else {
        // Se asume que el body ES el producto
        $lista = [$body];
    }

    $guardados = 0;
    $pdo->beginTransaction();
    try {
        foreach ($lista as $producto) {
            if (!is_array($producto) || !isset($producto['id'])) {
                continue;
            }
            guardar_producto($pdo, $producto);
            $guardados++;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        responder_error('Error al guardar: ' . $e->getMessage(), 500);
    }

    responder_ok(['guardados' => $guardados]);
}

function guardar_producto(PDO $pdo, array $p)
{
    $sql = 'INSERT INTO productos
                (id, name, category, stock, unit, location, marca, lote,
                 prodDate, expDate, descripcion, image, state, enPapelera)
            VALUES
                (:id, :name, :category, :stock, :unit, :location, :marca, :lote,
                 :prodDate, :expDate, :descripcion, :image, :state, :enPapelera)
            ON DUPLICATE KEY UPDATE
                name        = VALUES(name),
                category    = VALUES(category),
                stock       = VALUES(stock),
                unit        = VALUES(unit),
                location    = VALUES(location),
                marca       = VALUES(marca),
                lote        = VALUES(lote),
                prodDate    = VALUES(prodDate),
                expDate     = VALUES(expDate),
                descripcion = VALUES(descripcion),
                image       = VALUES(image),
                state       = VALUES(state),
                enPapelera  = VALUES(enPapelera)';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':id'          => (int) $p['id'],
        ':name'        => isset($p['name']) ? $p['name'] : (isset($p['nombre']) ? $p['nombre'] : null),
        ':category'    => isset($p['category']) ? $p['category'] : null,
        ':stock'       => isset($p['stock']) ? $p['stock'] : (isset($p['cantidad']) ? $p['cantidad'] : 0),
        ':unit'        => isset($p['unit']) ? $p['unit'] : null,
        ':location'    => isset($p['location']) ? $p['location'] : null,
        ':marca'       => isset($p['marca']) ? $p['marca'] : null,
        ':lote'        => isset($p['lote']) ? $p['lote'] : null,
        ':prodDate'    => isset($p['prodDate']) ? $p['prodDate'] : null,
        ':expDate'     => isset($p['expDate']) ? $p['expDate'] : null,
        ':descripcion' => isset($p['desc']) ? $p['desc'] : null,
        ':image'       => isset($p['image']) ? $p['image'] : null,
        ':state'       => isset($p['state']) ? $p['state'] : null,
        ':enPapelera'  => !empty($p['_enPapelera']) ? 1 : 0,
    ]);
}

// ------------------------------------------------------------
// ELIMINAR: borrado definitivo por id
// ------------------------------------------------------------
function responder_eliminar(PDO $pdo, array $body)
{
    $id = null;
    if (isset($body['id'])) {
        $id = $body['id'];
    } elseif (isset($body['producto']['id'])) {
        $id = $body['producto']['id'];
    }

    if ($id === null) {
        responder_error('Falta el id del producto', 400);
    }

    $stmt = $pdo->prepare('DELETE FROM productos WHERE id = :id');
    $stmt->execute([':id' => (int) $id]);

    responder_ok(['eliminado' => (int) $id]);
}

// ------------------------------------------------------------
// Helpers de conversion y respuesta
// ------------------------------------------------------------
function fila_a_producto(array $fila)
{
    $producto = [
        'id'       => (int) $fila['id'],
        'name'     => $fila['name'],
        'category' => $fila['category'],
        'stock'    => $fila['stock'] !== null ? (float) $fila['stock'] : null,
        'unit'     => $fila['unit'],
        'location' => $fila['location'],
        'marca'    => $fila['marca'],
        'lote'     => $fila['lote'],
        'prodDate' => $fila['prodDate'],
        'expDate'  => $fila['expDate'],
        'desc'     => $fila['descripcion'],
        'image'    => $fila['image'],
        'state'    => $fila['state'],
        '_enPapelera' => ((int) $fila['enPapelera']) === 1,
    ];
    return $producto;
}

function responder_ok(array $extra = [])
{
    echo json_encode(array_merge(['ok' => true], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

function responder_error($mensaje, $codigo = 500)
{
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $mensaje], JSON_UNESCAPED_UNICODE);
    exit;
}