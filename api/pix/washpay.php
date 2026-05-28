<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

define('WASHPAY_API_KEY', 'pk_cfaba8390414365c5b732fd953f6b5cce9d8b0e79488293571394bf5662bc436');
define('WASHPAY_BASE_URL', 'https://washpay.com.br/api/user');

function wpPost($endpoint, $data) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WASHPAY_BASE_URL . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . WASHPAY_API_KEY,
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $httpCode, 'data' => json_decode($response, true)];
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { echo json_encode(['success' => false, 'error' => 'Dados inválidos']); exit; }

$total = floatval($input['total'] ?? 0);
$items = $input['items'] ?? [];
if ($total <= 0) { echo json_encode(['success' => false, 'error' => 'Valor inválido']); exit; }

$productName = 'Produto';
if (!empty($items)) {
    $names = [];
    foreach ($items as $item) { $n = $item['nome'] ?? $item['name'] ?? ''; if ($n) $names[] = $n; }
    if (!empty($names)) { $productName = implode(' + ', array_slice($names, 0, 3)); if (count($names) > 3) $productName .= ' e mais'; }
}

// 1. Criar produto
$pr = wpPost('/products', ['name' => $productName, 'price' => $total]);
if (!$pr['data']['success']) { echo json_encode(['success' => false, 'error' => 'Erro ao criar produto']); exit; }
$productId = $pr['data']['data']['id'];

// 2. Criar payment link com productId (singular!)
$title = $input['order_id'] ?? $productName;
$lr = wpPost('/payment-links', ['title' => $title, 'amount' => $total, 'productId' => $productId]);
if (!$lr['data']['success']) { echo json_encode(['success' => false, 'error' => 'Erro ao criar link']); exit; }
$linkId = $lr['data']['data']['id'];

// Salvar dados
$orderId = $input['order_id'] ?? ('ORDER_' . time());
$txDir = __DIR__ . '/../../transactions';
if (!is_dir($txDir)) @mkdir($txDir, 0755, true);
file_put_contents("$txDir/washpay_{$linkId}.json", json_encode([
    'payment_link_id' => $linkId, 'product_id' => $productId, 'order_id' => $orderId,
    'amount' => $total, 'product_name' => $productName, 'created_at' => date('c'),
    'pay_url' => 'https://washpay.com.br/pay/' . $linkId, 'status' => 'PENDING'
]));

echo json_encode(['success' => true, 'data' => [
    'transaction_id' => $linkId,
    'payment_link_id' => $linkId,
    'pay_url' => 'https://washpay.com.br/pay/' . $linkId,
    'amount' => $total
]]);
