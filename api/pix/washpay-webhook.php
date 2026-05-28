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
$orderNumber = $data['orderNumber'] ?? '';
$status = $data['status'] ?? '';
$amount = $data['amount'] ?? 0;

$logFile = __DIR__ . '/../../washpay_webhook.log';
file_put_contents($logFile, date('c') . ' | ' . $orderId . ' | ' . $status . ' | ' . json_encode($data) . "\n", FILE_APPEND);

if (!$orderId) { echo json_encode(['success' => false]); exit; }

$txDir = __DIR__ . '/../../transactions';
if (!is_dir($txDir)) @mkdir($txDir, 0755, true);

// Procura transação por payment_link_id (orderId do webhook = payment_link_id)
$txFile = "$txDir/washpay_{$orderId}.json";

if (file_exists($txFile)) {
    $tx = json_decode(file_get_contents($txFile), true);
    $tx['webhook_received'] = true;
    $tx['paid_at'] = date('c');
    file_put_contents($txFile, json_encode($tx, JSON_PRETTY_PRINT));
}

// Cria arquivo de status para polling
file_put_contents("$txDir/washpay_status.json", json_encode([
    'order_id' => $orderId,
    'order_number' => $orderNumber,
    'amount' => $amount,
    'status' => $status,
    'updated_at' => date('c')
]));

echo json_encode(['success' => true]);
