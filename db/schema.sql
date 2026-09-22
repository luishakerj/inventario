-- ============================================================
-- schema.sql  -  Base de datos MySQL para el Inventario LICC
-- ============================================================
-- Como usarlo:
--   1. Abre phpMyAdmin (en XAMPP: http://localhost/phpmyadmin).
--   2. Pestaña "Importar" -> selecciona este archivo -> Continuar.
--      (o pega todo en la pestaña "SQL" y ejecuta)
--
-- Tambien puedes ejecutarlo por consola:
--   mysql -u root -p < db/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `licc_inventario`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `licc_inventario`;

-- ------------------------------------------------------------
-- Tabla de productos del inventario
-- El campo `id` guarda el mismo id que genera la app (timestamp),
-- por eso es BIGINT y no AUTO_INCREMENT: la app decide el id.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `productos` (
    `id`          BIGINT       NOT NULL,
    `name`        VARCHAR(255) NULL,
    `category`    VARCHAR(150) NULL,
    `stock`       DECIMAL(12,2) NULL DEFAULT 0,
    `unit`        VARCHAR(60)  NULL,
    `location`    VARCHAR(255) NULL,
    `marca`       VARCHAR(255) NULL,
    `lote`        VARCHAR(120) NULL,
    `prodDate`    VARCHAR(40)  NULL,
    `expDate`     VARCHAR(40)  NULL,
    `descripcion` TEXT         NULL,
    `image`       LONGTEXT     NULL,
    `state`       VARCHAR(80)  NULL,
    `enPapelera`  TINYINT(1)   NOT NULL DEFAULT 0,
    `updatedAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_papelera` (`enPapelera`),
    KEY `idx_nombre`   (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;