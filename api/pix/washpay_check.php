<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$linkId = $_GET['link_id'] ?? '';
if (!$linkId) {
    echo json_encode(['success' => false, 'error' => 'link_id required']);
    exit;
}

define('WASHPAY_API_KEY', 'pk_cfaba8390414365c5b732fd953f6b5cce9d8b0e79488293571394bf5662bc436');
define('WASHPAY_BASE_URL', 'https://washpay.com.br/api/user');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, WASHPAY_BASE_URL . '/orders?paymentLinkId=' . urlencode($linkId));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . WASHPAY_API_KEY,
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
curl_close($ch);

$apiData = json_decode($response, true);
if (!$apiData || !$apiData['success']) {
    echo json_encode(['success' => false, 'error' => 'API error']);
    exit;
}

$orders = $apiData['data']['orders'] ?? [];
$found = null;

foreach ($orders as $order) {
    $paymentLink = $order['paymentLink'] ?? [];
    if (($paymentLink['id'] ?? '') === $linkId) {
        $found = $order;
        break;
    }
}

if (!$found) {
    echo json_encode(['success' => true, 'status' => 'PENDING', 'order' => null]);
    exit;
}

$status = $found['status'];
echo json_encode([
    'success' => true,
    'status' => $status,
    'order' => [
        'id' => $found['id'],
        'order_number' => $found['orderNumber'] ?? '',
        'total' => $found['totalAmount'] ?? 0,
        'status' => $status,
        'pix_transaction_id' => $found['pixTransactionId'] ?? ''
    ]
]);
