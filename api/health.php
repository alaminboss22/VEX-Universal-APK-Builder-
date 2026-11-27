<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require __DIR__ . '/db.php';

try {
    $pdo->query('SELECT 1');
    echo json_encode([
        'ok' => true,
        'service' => 'VEX Universal APK Builder API',
        'database' => 'connected'
    ]);
} catch (Throwable $e) {
    error_log('VEX health check failed: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Health check failed.']);
}
