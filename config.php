<?php
// ============================================================
// config.php  -  Credenciales de MySQL para el Inventario LICC
// ============================================================
// Edita SOLO estos valores segun tu servidor MySQL.
// Si usas XAMPP/MAMP con valores por defecto, lo mas probable es
// que solo necesites cambiar DB_PASS (o dejarlo vacio).
// ============================================================

define('DB_HOST', '127.0.0.1');   // Servidor MySQL (XAMPP: localhost / 127.0.0.1)
define('DB_PORT', 3306);          // Puerto MySQL (por defecto 3306)
define('DB_NAME', 'licc_inventario');
define('DB_USER', 'root');        // XAMPP por defecto: root
define('DB_PASS', '');            // XAMPP por defecto: vacio. Pon tu clave si la tienes.

// ------------------------------------------------------------
// Devuelve una conexion PDO lista para usar.
// ------------------------------------------------------------
function conectar_db()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'    => false,
            'error' => 'No se pudo conectar a MySQL: ' . $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $pdo;
}