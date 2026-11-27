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


if ($action === 'forgot_password') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
        respond(422, ['ok' => false, 'error' => 'Enter a valid email address.']);
    }

    // Keep the response identical whether the account exists or not.
    $generic = 'If an account exists for that email, a password reset link will be sent.';
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
    if ($user) {
        $rate = $pdo->prepare('SELECT created_at FROM password_resets WHERE user_id = :uid AND created_at > (NOW() - INTERVAL 60 SECOND) LIMIT 1');
        $rate->execute(['uid' => $user['id']]);
        if ($rate->fetch()) {
            respond(200, ['ok' => true, 'message' => $generic]);
        }

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $expires = date('Y-m-d H:i:s', time() + 900);
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = :uid')->execute(['uid' => $user['id']]);
        $save = $pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:uid, :hash, :expires)');
        $save->execute(['uid' => $user['id'], 'hash' => $tokenHash, 'expires' => $expires]);

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = preg_replace('/[^a-z0-9.:-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'videocut.site.je'));
        $resetUrl = $scheme . '://' . $host . '/?reset=' . rawurlencode($token);
        $subject = 'VEX Universal APK Builder password reset';
        $body = "A password reset was requested for your VEX account.\\n\\nOpen this link within 15 minutes to choose a new password:\\n" . $resetUrl . "\\n\\nIf you did not request this, ignore this email.";
        $headers = "From: VEX APK Builder <no-reply@" . $host . ">\\r\\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\\r\\n";
        if (!function_exists('mail') || !@mail($email, $subject, $body, $headers)) {
            error_log('VEX password reset email could not be sent for user id ' . (int)$user['id']);
            // Remove the unusable token so it cannot be used if delivery failed.
            $pdo->prepare('DELETE FROM password_resets WHERE user_id = :uid')->execute(['uid' => $user['id']]);
        }
    }
    respond(200, ['ok' => true, 'message' => $generic]);
}

if ($action === 'reset_password') {
    $token = (string)($input['token'] ?? '');
    $password = (string)($input['password'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        respond(422, ['ok' => false, 'error' => 'This reset link is invalid or expired.']);
    }
    if (strlen($password) < 10 || strlen($password) > 200) {
        respond(422, ['ok' => false, 'error' => 'Password must be 10 to 200 characters.']);
    }
    $tokenHash = hash('sha256', $token);
    $stmt = $pdo->prepare('SELECT id, user_id FROM password_resets WHERE token_hash = :hash AND expires_at > NOW() LIMIT 1');
    $stmt->execute(['hash' => $tokenHash]);
    $reset = $stmt->fetch();
    if (!$reset) {
        respond(400, ['ok' => false, 'error' => 'This reset link is invalid or expired.']);
    }
    $newHash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :uid')->execute(['hash' => $newHash, 'uid' => $reset['user_id']]);
    $pdo->prepare('DELETE FROM password_resets WHERE user_id = :uid')->execute(['uid' => $reset['user_id']]);
    respond(200, ['ok' => true, 'message' => 'Password updated. Please sign in with your new password.']);
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
