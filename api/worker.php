<?php
declare(strict_types=1);
header('Cache-Control: no-store');
function respond(int $status,array $data): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data,JSON_UNESCAPED_SLASHES); exit; }
$configFile=dirname(__DIR__).'/config.php';
$config=is_file($configFile)?require $configFile:[];
$expected=(string)($config['worker_token']??'');
$provided=(string)($_SERVER['HTTP_X_VEX_WORKER_TOKEN']??'');
$isWorker=$expected!=='' && $provided!=='' && hash_equals($expected,$provided);
$downloadId=filter_input(INPUT_GET,'download',FILTER_VALIDATE_INT);
if($downloadId){
  session_start();
  if(empty($_SESSION['user_id'])){http_response_code(401);exit('Sign in required.');}
  require __DIR__.'/db.php';
  $q=$pdo->prepare('SELECT b.apk_path FROM builds b INNER JOIN projects p ON p.id=b.project_id WHERE b.id=:id AND p.user_id=:uid AND b.status=\'success\' LIMIT 1');
  $q->execute(['id'=>$downloadId,'uid'=>(int)$_SESSION['user_id']]);$row=$q->fetch();
  if(!$row||empty($row['apk_path'])){http_response_code(404);exit('APK not found.');}
  $file=dirname(__DIR__).'/'.ltrim($row['apk_path'],'/');
  if(!is_file($file)){http_response_code(404);exit('APK file missing.');}
  header('Content-Type: application/vnd.android.package-archive');header('Content-Length: '.filesize($file));header('Content-Disposition: attachment; filename="VEX-build-'.$downloadId.'.apk"');readfile($file);exit;
}
if(!$isWorker) respond(403,['ok'=>false,'error'=>'Worker authentication failed.']);
require __DIR__.'/db.php';
$action=(string)($_POST['action']??$_GET['action']??'');
if($_SERVER['REQUEST_METHOD']==='POST' && $action==='claim'){
  $pdo->beginTransaction();
  try{
    $q=$pdo->query("SELECT b.id,b.build_format,b.build_type,p.project_name,p.source_zip FROM builds b INNER JOIN projects p ON p.id=b.project_id WHERE b.status='queued' ORDER BY b.id ASC LIMIT 1 FOR UPDATE");
    $job=$q->fetch();
    if(!$job){$pdo->commit();respond(200,['ok'=>true,'job'=>null]);}
    $token=bin2hex(random_bytes(32));
    $u=$pdo->prepare("UPDATE builds SET status='building',started_at=NOW(),worker_token_hash=:hash,worker_token_expires_at=DATE_ADD(NOW(),INTERVAL 2 HOUR),log_text=CONCAT(COALESCE(log_text,''),'\\nWorker claimed build.') WHERE id=:id");
    $u->execute(['hash'=>hash('sha256',$token),'id'=>$job['id']]);
    $pdo->prepare("UPDATE projects SET status='building' WHERE id=(SELECT project_id FROM builds WHERE id=:id)")->execute(['id'=>$job['id']]);
    $pdo->commit();
    $scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'https';
    $base=$scheme.'://'.($_SERVER['HTTP_HOST']??'videocut.site.je');
    respond(200,['ok'=>true,'job'=>['id'=>(int)$job['id'],'project_name'=>$job['project_name'],'build_format'=>$job['build_format'],'build_type'=>$job['build_type'],'build_token'=>$token,'download_url'=>$base.'/api/worker.php?fetch='.(int)$job['id'].'&token='.$token]]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('VEX worker claim: '.$e->getMessage());respond(500,['ok'=>false,'error'=>'Could not claim build.']);}
}
$fetchId=filter_input(INPUT_GET,'fetch',FILTER_VALIDATE_INT);
if($_SERVER['REQUEST_METHOD']==='GET' && $fetchId){
  $token=(string)($_GET['token']??'');
  $q=$pdo->prepare("SELECT p.source_zip FROM builds b INNER JOIN projects p ON p.id=b.project_id WHERE b.id=:id AND b.status='building' AND b.worker_token_hash=:hash AND b.worker_token_expires_at>NOW() LIMIT 1");
  $q->execute(['id'=>$fetchId,'hash'=>hash('sha256',$token)]);$row=$q->fetch();
  if(!$row){http_response_code(403);exit('Invalid or expired build token.');}
  $file=dirname(__DIR__).'/'.ltrim($row['source_zip'],'/');
  if(!is_file($file)){http_response_code(404);exit('Source ZIP not found.');}
  header('Content-Type: application/zip');header('Content-Length: '.filesize($file));header('Content-Disposition: attachment; filename="project.zip"');readfile($file);exit;
}
if($_SERVER['REQUEST_METHOD']==='POST' && $action==='finish'){
  $id=filter_var($_POST['build_id']??null,FILTER_VALIDATE_INT);
  $token=(string)($_POST['build_token']??'');$status=(string)($_POST['status']??'failed');
  if(!$id||!in_array($status,['success','failed'],true))respond(422,['ok'=>false,'error'=>'Invalid build result.']);
  $q=$pdo->prepare("SELECT b.project_id FROM builds b WHERE b.id=:id AND b.status='building' AND b.worker_token_hash=:hash AND b.worker_token_expires_at>NOW() LIMIT 1");
  $q->execute(['id'=>$id,'hash'=>hash('sha256',$token)]);$row=$q->fetch();
  if(!$row)respond(403,['ok'=>false,'error'=>'Build token is invalid or expired.']);
  $log=substr((string)($_POST['log_text']??''),0,60000);$relative=null;
  if($status==='success'){
    if(!isset($_FILES['artifact'])||$_FILES['artifact']['error']!==UPLOAD_ERR_OK)respond(422,['ok'=>false,'error'=>'Successful build must include an artifact file.']);
    if((int)$_FILES['artifact']['size']<1||(int)$_FILES['artifact']['size']>100*1024*1024)respond(413,['ok'=>false,'error'=>'Artifact must be smaller than 100 MB.']);
    $ext=(string)($_POST['artifact_ext']??'apk');if(!in_array($ext,['apk','aab'],true))respond(422,['ok'=>false,'error'=>'Invalid artifact type.']);
    $dir=dirname(__DIR__).'/storage/builds';if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))respond(500,['ok'=>false,'error'=>'Artifact storage unavailable.']);
    $name=bin2hex(random_bytes(20)).'.'.$ext;$dest=$dir.'/'.$name;
    if(!is_uploaded_file($_FILES['artifact']['tmp_name'])||!move_uploaded_file($_FILES['artifact']['tmp_name'],$dest))respond(500,['ok'=>false,'error'=>'Could not store build artifact.']);
    @chmod($dest,0640);$relative='storage/builds/'.$name;
  }
  $pdo->beginTransaction();
  try{
    $u=$pdo->prepare('UPDATE builds SET status=:status,log_text=:log,apk_path=:path,finished_at=NOW(),worker_token_hash=NULL,worker_token_expires_at=NULL WHERE id=:id');
    $u->execute(['status'=>$status,'log'=>$log,'path'=>$relative,'id'=>$id]);
    $pdo->prepare('UPDATE projects SET status=:status WHERE id=:pid')->execute(['status'=>$status,'pid'=>$row['project_id']]);
    $pdo->commit();respond(200,['ok'=>true,'message'=>'Build result saved.']);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($relative)@unlink(dirname(__DIR__).'/'.$relative);error_log('VEX worker finish: '.$e->getMessage());respond(500,['ok'=>false,'error'=>'Could not save build result.']);}
}
respond(400,['ok'=>false,'error'=>'Unknown worker action.']);
