<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    respond(200, [
        'ok' => true,
        'authenticated' => isset($_SESSION['user_id']),
        'user' => isset($_SESSION['user_id']) ? [
            'id' => (int)$_SESSION['user_id'],
            'email' => (string)$_SESSION['user_email'],
        ] : null,
        'csrf_token' => $_SESSION['csrf'],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON request.']);
}
$csrf = (string)($input['csrf_token'] ?? '');
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $csrf)) {
    respond(403, ['ok' => false, 'error' => 'Session expired. Refresh and try again.']);
}

require __DIR__ . '/db.php';
$action = (string)($input['action'] ?? '');

if ($action === 'register') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
        respond(422, ['ok' => false, 'error' => 'Enter a valid email address.']);
    }
    if (strlen($password) < 10 || strlen($password) > 200) {
        respond(422, ['ok' => false, 'error' => 'Password must be 10 to 200 characters.']);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    try {
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (:email, :hash)');
        $stmt->execute(['email' => $email, 'hash' => $hash]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            respond(409, ['ok' => false, 'error' => 'An account with this email already exists.']);
        }
        error_log('VEX registration failed: ' . $e->getMessage());
        respond(500, ['ok' => false, 'error' => 'Could not create account. Please try again.']);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$pdo->lastInsertId();
    $_SESSION['user_email'] = $email;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    respond(201, ['ok' => true, 'message' => 'Account created.', 'user' => ['id' => $_SESSION['user_id'], 'email' => $email], 'csrf_token' => $_SESSION['csrf']]);
}

if ($action === 'login') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        respond(422, ['ok' => false, 'error' => 'Enter your email and password.']);
    }
    $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(401, ['ok' => false, 'error' => 'Email or password is incorrect.']);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['user_email'] = (string)$user['email'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    respond(200, ['ok' => true, 'message' => 'Logged in.', 'user' => ['id' => $_SESSION['user_id'], 'email' => $_SESSION['user_email']], 'csrf_token' => $_SESSION['csrf']]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['ok' => true, 'message' => 'Logged out.']);
}

respond(400, ['ok' => false, 'error' => 'Unknown action.']);
