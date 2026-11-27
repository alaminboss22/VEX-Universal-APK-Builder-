<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']);
session_start();
function out(int $status,array $data): never { http_response_code($status); echo json_encode($data,JSON_UNESCAPED_SLASHES); exit; }
if (empty($_SESSION['user_id'])) out(401,['ok'=>false,'error'=>'Please sign in first.']);
require __DIR__.'/db.php';
$uid=(int)$_SESSION['user_id'];
if($_SERVER['REQUEST_METHOD']==='GET'){
  $p=$pdo->prepare('SELECT id,project_name,status,created_at FROM projects WHERE user_id=:uid ORDER BY id DESC LIMIT 100');
  $p->execute(['uid'=>$uid]);
  $b=$pdo->prepare('SELECT b.id,b.status,b.log_text,b.build_format,b.build_type,b.created_at,p.project_name FROM builds b INNER JOIN projects p ON p.id=b.project_id WHERE p.user_id=:uid ORDER BY b.id DESC LIMIT 100');
  $b->execute(['uid'=>$uid]);
  out(200,['ok'=>true,'projects'=>$p->fetchAll(PDO::FETCH_ASSOC),'builds'=>$b->fetchAll(PDO::FETCH_ASSOC)]);
}
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: GET, POST');out(405,['ok'=>false,'error'=>'Method not allowed.']);}
$in=json_decode(file_get_contents('php://input'),true);
if(!is_array($in))out(400,['ok'=>false,'error'=>'Invalid request.']);
$csrf=(string)($in['csrf_token']??'');
if(empty($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],$csrf))out(403,['ok'=>false,'error'=>'Session expired. Refresh and try again.']);
if(($in['action']??'')!=='create')out(400,['ok'=>false,'error'=>'Unknown action.']);
$projectId=filter_var($in['project_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
$c=$in['config']??[];
if(!$projectId||!is_array($c))out(422,['ok'=>false,'error'=>'Choose a valid uploaded project.']);
$app=trim((string)($c['app_name']??''));$pkg=trim((string)($c['package_id']??''));
$version=trim((string)($c['version_name']??'1.0.0'));$code=filter_var($c['version_code']??1,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>2147483647]]);
$format=(string)($c['build_format']??'apk');$type=(string)($c['build_type']??'debug');
if($app===''||strlen($app)>80)out(422,['ok'=>false,'error'=>'Application name must be 1 to 80 characters.']);
if(!preg_match('/^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*){1,}$/',$pkg)||strlen($pkg)>180)out(422,['ok'=>false,'error'=>'Enter a valid package ID, such as com.example.myapp.']);
if($version===''||strlen($version)>32||!$code)out(422,['ok'=>false,'error'=>'Enter a valid version name and version code.']);
if(!in_array($format,['apk','aab'],true)||!in_array($type,['debug','release'],true))out(422,['ok'=>false,'error'=>'Invalid build format or type.']);
$check=$pdo->prepare('SELECT id FROM projects WHERE id=:pid AND user_id=:uid LIMIT 1');$check->execute(['pid'=>$projectId,'uid'=>$uid]);
if(!$check->fetch())out(404,['ok'=>false,'error'=>'That project was not found in your account.']);
$config=['app_name'=>$app,'package_id'=>$pkg,'version_name'=>$version,'version_code'=>$code,'build_format'=>$format,'build_type'=>$type];
$pdo->beginTransaction();
try{
  $stmt=$pdo->prepare("INSERT INTO builds (project_id,status,log_text,config_json,build_format,build_type) VALUES (:pid,'queued',:log,:config,:format,:type)");
  $stmt->execute(['pid'=>$projectId,'log'=>'Build request saved. Waiting for a connected Android build worker.','config'=>json_encode($config,JSON_UNESCAPED_SLASHES),'format'=>$format,'type'=>$type]);
  $pdo->prepare("UPDATE projects SET status='queued' WHERE id=:pid AND user_id=:uid")->execute(['pid'=>$projectId,'uid'=>$uid]);
  $id=(int)$pdo->lastInsertId();$pdo->commit();
  out(201,['ok'=>true,'message'=>'Build request saved. A build worker is still required to compile the APK/AAB.','build_id'=>$id,'status'=>'queued']);
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('VEX build request error: '.$e->getMessage());out(500,['ok'=>false,'error'=>'Could not save the build request.']);}
