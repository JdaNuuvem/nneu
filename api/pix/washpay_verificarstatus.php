<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$orderId = $_GET['order_id'] ?? $_GET['transaction_id'] ?? '';
if (!$orderId) {
    echo json_encode(['success' => false, 'error' => 'order_id required']);
    exit;
}

define('WASHPAY_API_KEY', 'pk_cfaba8390414365c5b732fd953f6b5cce9d8b0e79488293571394bf5662bc436');

// Try to get order status from WashPay API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://washpay.com.br/api/user/orders/' . urlencode($orderId));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . WASHPAY_API_KEY,
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
if (!$data || !$data['success']) {
    // Fallback: check local transaction file
    $txDir = __DIR__ . '/../../transactions';
    $files = glob("$txDir/washpay_*.json");
    foreach ($files as $f) {
        $tx = json_decode(file_get_contents($f), true);
        if (($tx['order_id'] ?? '') === $orderId) {
            echo json_encode(['success' => true, 'data' => ['transaction_id' => $orderId, 'status' => $tx['status'] ?? 'PENDING']]);
            exit;
        }
    }
    echo json_encode(['success' => true, 'data' => ['transaction_id' => $orderId, 'status' => 'PENDING']]);
    exit;
}

$orderData = $data['data'] ?? [];
$status = $orderData['status'] ?? 'PENDING';
$apiStatus = ($status === 'PAID') ? 'approved' : (($status === 'CANCELLED') ? 'cancelled' : 'pending');

echo json_encode([
    'success' => true,
    'data' => [
        'transaction_id' => $orderId,
        'status' => $apiStatus,
        'raw_status' => $status
    ]
]);
