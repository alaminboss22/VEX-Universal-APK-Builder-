<?php
declare(strict_types=1);

/*
 * Loads private database settings from /config.php.
 * Never commit config.php or share its contents.
 */
$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Server configuration is missing.']);
    exit;
}
$config = require $configFile;

if (!is_array($config) || !isset($config['db_host'], $config['db_name'], $config['db_user'], $config['db_pass'])) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Server configuration is invalid.']);
    exit;
}

$dsn = sprintf(
    'mysql:host=%s;dbname=%s;port=%d;charset=utf8mb4',
    $config['db_host'],
    $config['db_name'],
    (int)($config['db_port'] ?? 3306)
);

try {
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    error_log('VEX database connection failed: ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Database connection failed. Check private server configuration.']);
    exit;
}
