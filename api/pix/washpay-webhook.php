<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!$data) { echo json_encode(['success' => false]); exit; }

$orderId = $data['orderId'] ?? '';
$status = $data['status'] ?? '';
$amount = $data['amount'] ?? 0;

$logFile = __DIR__ . '/../../washpay_webhook.log';
file_put_contents($logFile, date('c') . ' | ' . $orderId . ' | ' . $status . ' | ' . json_encode($data) . "\n", FILE_APPEND);

if (!$orderId) { echo json_encode(['success' => false]); exit; }

$txDir = __DIR__ . '/../../transactions';
$txFile = "$txDir/washpay_{$orderId}.json";

if (!is_dir($txDir)) @mkdir($txDir, 0755, true);

$tx = file_exists($txFile) ? json_decode(file_get_contents($txFile), true) : [];
$tx['status'] = $status;
$tx['updated_at'] = date('c');
$tx['webhook_data'] = $data;

if ($status === 'PAID') {
    $tx['paid_at'] = date('c');
    file_put_contents($txFile . '.paid', json_encode($data));
}

file_put_contents($txFile, json_encode($tx, JSON_PRETTY_PRINT));

// Se tem verificarstatus.php adaptado, notifica
$vsPath = __DIR__ . '/washpay_verificarstatus.php';
if (!file_exists($vsPath)) {
    file_put_contents($vsPath, '<?php
header("Content-Type: application/json");
$tid = $_GET["transaction_id"] ?? "";
if (!$tid) { echo json_encode(["success"=>false]); exit; }
$file = __DIR__ . "/../../transactions/washpay_".basename($tid).".json";
if (!file_exists($file)) { echo json_encode(["success"=>false,"error"=>"not found"]); exit; }
$tx = json_decode(file_get_contents($file), true);
echo json_encode([
    "success" => true,
    "data" => [
        "transaction_id" => $tid,
        "status" => $tx["status"] ?? "PENDING"
    ]
]);
');
}

echo json_encode(['success' => true]);
