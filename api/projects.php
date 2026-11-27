<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'secure' => $isHttps,
    'httponly' => true, 'samesite' => 'Lax',
]);
session_start();

function reply(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}
function iniBytes(string $value): int {
    $value = trim($value);
    if ($value === '') return 0;
    $unit = strtolower($value[strlen($value) - 1]);
    $number = (float)$value;
    if ($unit === 'g') $number *= 1024;
    if ($unit === 'g' || $unit === 'm') $number *= 1024;
    if ($unit === 'g' || $unit === 'm' || $unit === 'k') $number *= 1024;
    return (int)$number;
}
$uploadLimit = min(100 * 1024 * 1024, iniBytes((string)ini_get('upload_max_filesize')));
$postLimit = iniBytes((string)ini_get('post_max_size'));
if ($postLimit > 0) $uploadLimit = min($uploadLimit, max(0, $postLimit - 1024 * 1024));

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['user_id'])) reply(401, ['ok'=>false,'error'=>'Please sign in to view your projects.']);
    require __DIR__ . '/db.php';
    $stmt = $pdo->prepare('SELECT id, project_name, status, created_at FROM projects WHERE user_id = :uid ORDER BY id DESC LIMIT 100');
    $stmt->execute(['uid'=>(int)$_SESSION['user_id']]);
    reply(200, ['ok'=>true,'projects'=>$stmt->fetchAll(),'max_upload_bytes'=>$uploadLimit,'zip_validation'=>class_exists('ZipArchive')]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    reply(405, ['ok'=>false,'error'=>'Method not allowed.']);
}
if (empty($_SESSION['user_id'])) reply(401, ['ok'=>false,'error'=>'Please sign in before uploading.']);
$csrf = (string)($_POST['csrf_token'] ?? '');
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $csrf)) {
    reply(403, ['ok'=>false,'error'=>'Session expired. Refresh the page and try again.']);
}
if (!class_exists('ZipArchive')) reply(503, ['ok'=>false,'error'=>'ZIP inspection is not available on this hosting server. Please contact hosting support.']);
if (!isset($_FILES['project_file'])) {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 0 && $postLimit > 0 && $contentLength > $postLimit) {
        reply(413, ['ok'=>false,'error'=>'The upload exceeds this server’s POST size limit.']);
    }
    reply(400, ['ok'=>false,'error'=>'Choose a ZIP file first.']);
}
$file = $_FILES['project_file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $messages = [
        UPLOAD_ERR_INI_SIZE=>'File exceeds the server upload limit.',
        UPLOAD_ERR_FORM_SIZE=>'File is too large.',
        UPLOAD_ERR_PARTIAL=>'Upload was interrupted. Try again.',
        UPLOAD_ERR_NO_FILE=>'Choose a ZIP file first.',
        UPLOAD_ERR_NO_TMP_DIR=>'Server temporary folder is missing.',
        UPLOAD_ERR_CANT_WRITE=>'Server could not save the uploaded file.',
        UPLOAD_ERR_EXTENSION=>'A server extension stopped the upload.',
    ];
    reply(400, ['ok'=>false,'error'=>$messages[$file['error']] ?? 'Upload failed.']);
}
$size = (int)$file['size'];
if ($size < 22) reply(422, ['ok'=>false,'error'=>'The selected file is too small to be a valid ZIP archive.']);
if ($size > $uploadLimit) reply(413, ['ok'=>false,'error'=>'File is larger than the current server limit (' . round($uploadLimit / 1048576, 1) . ' MB).']);
$original = basename(str_replace('\\', '/', (string)$file['name']));
if (strtolower(pathinfo($original, PATHINFO_EXTENSION)) !== 'zip') reply(422, ['ok'=>false,'error'=>'Only .zip files are accepted.']);
if (!is_uploaded_file($file['tmp_name'])) reply(400, ['ok'=>false,'error'=>'Invalid upload source.']);

$zip = new ZipArchive();
$opened = $zip->open($file['tmp_name'], ZipArchive::CHECKCONS);
if ($opened !== true) reply(422, ['ok'=>false,'error'=>'This ZIP archive is damaged or invalid.']);
if ($zip->numFiles < 1 || $zip->numFiles > 10000) {
    $zip->close();
    reply(422, ['ok'=>false,'error'=>'ZIP must contain between 1 and 10,000 entries.']);
}
$totalExpanded = 0;
for ($i=0; $i<$zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $name = (string)($stat['name'] ?? '');
    $normalized = str_replace('\\', '/', $name);
    if ($normalized === '' || str_starts_with($normalized, '/') || preg_match('/^[a-zA-Z]:/', $normalized) || preg_match('#(^|/)\.\.(/|$)#', $normalized)) {
        $zip->close();
        reply(422, ['ok'=>false,'error'=>'ZIP contains an unsafe file path.']);
    }
    $totalExpanded += (int)($stat['size'] ?? 0);
    if ($totalExpanded > 500 * 1024 * 1024) {
        $zip->close();
        reply(422, ['ok'=>false,'error'=>'Uncompressed ZIP contents exceed the 500 MB safety limit.']);
    }
}
$zip->close();

require __DIR__ . '/db.php';
$storage = dirname(__DIR__) . '/storage/projects';
if (!is_dir($storage) && !mkdir($storage, 0750, true) && !is_dir($storage)) {
    reply(500, ['ok'=>false,'error'=>'Private project storage could not be created.']);
}
$projectId = bin2hex(random_bytes(16));
$storedName = $projectId . '.zip';
$destination = $storage . '/' . $storedName;
if (!move_uploaded_file($file['tmp_name'], $destination)) reply(500, ['ok'=>false,'error'=>'Could not save the ZIP file on the server.']);
@chmod($destination, 0640);
$projectName = trim(pathinfo($original, PATHINFO_FILENAME));
$projectName = preg_replace('/[^\pL\pN _.-]/u', '', $projectName) ?? 'Android project';
$projectName = function_exists('mb_substr') ? mb_substr($projectName, 0, 120) : substr($projectName, 0, 120);
if ($projectName === '') $projectName = 'Android project';
try {
    $stmt = $pdo->prepare("INSERT INTO projects (user_id, project_name, source_zip, status) VALUES (:uid, :name, :file, 'uploaded')");
    $stmt->execute(['uid'=>(int)$_SESSION['user_id'], 'name'=>$projectName, 'file'=>'storage/projects/'.$storedName]);
    reply(201, ['ok'=>true,'message'=>'Project ZIP uploaded and saved to your account.','project'=>['id'=>(int)$pdo->lastInsertId(),'project_name'=>$projectName,'status'=>'uploaded','created_at'=>date('Y-m-d H:i:s')]]);
} catch (Throwable $e) {
    @unlink($destination);
    error_log('VEX project upload database error: '.$e->getMessage());
    reply(500, ['ok'=>false,'error'=>'The file was received but could not be linked to your account. Please retry.']);
}
