<?php
session_start();

$PASSWORD = 'Rodrigo';
$UPLOAD_DIR = __DIR__ . '/uploads/';
$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'webp', 'mp4', 'mov', 'avi', 'm4v'];
$MAX_BYTES = 500 * 1024 * 1024; // 500MB

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password']) && !isset($_SESSION['authed'])) {
    if (hash_equals($PASSWORD, $_POST['password'])) {
        $_SESSION['authed'] = true;
    } else {
        $error = 'Wrong password.';
    }
}

$authed = isset($_SESSION['authed']) && $_SESSION['authed'] === true;

if ($authed && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $error = 'Upload failed (error code ' . $file['error'] . ').';
    } elseif ($file['size'] > $MAX_BYTES) {
        $error = 'File too large (max 500MB).';
    } else {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $ALLOWED_EXT, true)) {
            $error = 'File type not allowed. Only photos and videos.';
        } else {
            $base = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $name = $base . '_' . date('Ymd_His') . '_' . substr(md5(uniqid((string)mt_rand(), true)), 0, 6) . '.' . $ext;

            if (!is_dir($UPLOAD_DIR)) {
                mkdir($UPLOAD_DIR, 0755, true);
            }

            if (move_uploaded_file($file['tmp_name'], $UPLOAD_DIR . $name)) {
                $success = 'Uploaded: ' . $name;
            } else {
                $error = 'Could not save the file on the server.';
            }
        }
    }
}

$files = [];
if ($authed && is_dir($UPLOAD_DIR)) {
    foreach (scandir($UPLOAD_DIR) as $f) {
        if ($f === '.' || $f === '..' || $f === '.htaccess') continue;
        $files[] = $f;
    }
    rsort($files);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex, nofollow">
<title>Oleitech Uploads</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; color: #222; }
  h1 { font-size: 1.3rem; }
  input[type="password"], input[type="file"] { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; }
  button { padding: 10px 20px; background: #2164f4; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .error { color: #c0392b; }
  .success { color: #27ae60; }
  ul { padding-left: 20px; }
  li { margin: 6px 0; word-break: break-all; }
</style>
</head>
<body>
<h1>Oleitech Uploads</h1>

<?php if ($error): ?><p class="error"><?= htmlspecialchars($error) ?></p><?php endif; ?>
<?php if ($success): ?><p class="success"><?= htmlspecialchars($success) ?></p><?php endif; ?>

<?php if (!$authed): ?>
  <form method="post">
    <input type="password" name="password" placeholder="Password" required autofocus>
    <button type="submit">Enter</button>
  </form>
<?php else: ?>
  <form method="post" enctype="multipart/form-data">
    <input type="file" name="file" accept="image/*,video/*" required>
    <button type="submit">Upload</button>
  </form>

  <h2>Files</h2>
  <ul>
    <?php foreach ($files as $f): ?>
      <li><a href="uploads/<?= rawurlencode($f) ?>"><?= htmlspecialchars($f) ?></a></li>
    <?php endforeach; ?>
    <?php if (!$files): ?><li>(none yet)</li><?php endif; ?>
  </ul>
<?php endif; ?>

</body>
</html>
