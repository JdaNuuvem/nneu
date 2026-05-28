<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

$transactionId = $_GET['transaction_id'] ?? '';
if (!$transactionId) {
    echo json_encode(['success' => false, 'error' => 'transaction_id required']);
    exit;
}

$file = __DIR__ . '/../../transactions/washpay_' . basename($transactionId) . '.json';
if (!file_exists($file)) {
    echo json_encode(['success' => true, 'data' => ['transaction_id' => $transactionId, 'status' => 'PENDING']]);
    exit;
}

$tx = json_decode(file_get_contents($file), true);
$status = $tx['status'] ?? 'PENDING';

// Se já está pago, retorna approved
$apiStatus = $status;
if ($status === 'PAID') $apiStatus = 'approved';

echo json_encode([
    'success' => true,
    'data' => [
        'transaction_id' => $transactionId,
        'status' => $apiStatus,
        'raw_status' => $status
    ]
]);
