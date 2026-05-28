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
define('WEBHOOK_URL', 'https://seudominio.com/api/pix/washpay-webhook.php');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['success' => false, 'error' => 'Dados inválidos']);
    exit;
}

$buyer = $input['buyer'] ?? [];
$total = floatval($input['total'] ?? 0);
$items = $input['items'] ?? [];

$customerName = trim(($buyer['nomeCompleto'] ?? '') ?: (($buyer['nome'] ?? '') . ' ' . ($buyer['sobrenome'] ?? '')));
$customerEmail = $buyer['email'] ?? '';
$customerPhone = preg_replace('/[^0-9]/', '', $buyer['telefone'] ?? '');
$customerDocument = preg_replace('/[^0-9]/', '', $buyer['cpf'] ?? '');

if (empty($customerName) || empty($customerEmail) || empty($customerDocument) || $total <= 0) {
    echo json_encode(['success' => false, 'error' => 'Dados do cliente incompletos']);
    exit;
}

$productName = 'Produto';
$productPrice = $total;
if (!empty($items)) {
    $names = [];
    foreach ($items as $item) {
        $names[] = $item['nome'] ?? $item['name'] ?? 'Produto';
    }
    $productName = implode(' + ', array_slice($names, 0, 3));
    if (count($items) > 3) $productName .= ' e mais';
}

$webhookBase = rtrim(($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'), '/');
$webhookUrl = $webhookBase . '/api/pix/washpay-webhook.php';

$payload = [
    'product' => [
        'name' => $productName,
        'price' => $productPrice
    ],
    'paymentMethod' => 'PIX',
    'customer' => [
        'name' => $customerName,
        'email' => $customerEmail,
        'phone' => $customerPhone,
        'document' => $customerDocument
    ],
    'postbackUrl' => $webhookUrl
];

$orderId = $input['order_id'] ?? ('ORDER_' . time());
if (!empty($input['shipping'])) {
    $sh = $input['shipping'];
    $payload['shipping'] = [
        'address' => [
            'street' => $sh['logradouro'] ?? '',
            'number' => $sh['numero'] ?? '',
            'complement' => $sh['complemento'] ?? '',
            'neighborhood' => $sh['bairro'] ?? '',
            'city' => $sh['cidade'] ?? '',
            'state' => $sh['estado'] ?? '',
            'postalCode' => preg_replace('/[^0-9]/', '', $sh['cep'] ?? '')
        ]
    ];
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, WASHPAY_BASE_URL . '/direct-checkout');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . WASHPAY_API_KEY,
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode < 200 || $httpCode >= 300) {
    echo json_encode([
        'success' => false,
        'error' => $error ?: "Erro na API WashPay (HTTP $httpCode)",
        'api_response' => $response ? json_decode($response, true) : null,
        'http_status' => $httpCode
    ]);
    exit;
}

$apiData = json_decode($response, true);
$transactionId = $apiData['orderId'] ?? $apiData['id'] ?? ($apiData['data']['orderId'] ?? null);

if (!$transactionId) {
    echo json_encode([
        'success' => false,
        'error' => 'Resposta inválida da WashPay',
        'api_response' => $apiData,
        'http_status' => $httpCode
    ]);
    exit;
}

$pixCode = $apiData['pixCode'] ?? $apiData['pix']['qrcode'] ?? $apiData['data']['pixCode'] ?? $apiData['data']['pix']['qrcode'] ?? '';
$qrCode = $apiData['pixQrCode'] ?? $apiData['pix']['qrCodeBase64'] ?? $apiData['data']['pixQrCode'] ?? '';

// Guarda a transação para o polling
$txDir = __DIR__ . '/../../transactions';
if (!is_dir($txDir)) @mkdir($txDir, 0755, true);
file_put_contents("$txDir/washpay_$transactionId.json", json_encode([
    'transaction_id' => $transactionId,
    'order_id' => $orderId,
    'amount' => $total,
    'created_at' => date('c'),
    'status' => 'PENDING'
]));

echo json_encode([
    'success' => true,
    'data' => [
        'transaction_id' => $transactionId,
        'pix_code' => $pixCode,
        'payload' => $pixCode,
        'qr_code' => $qrCode ?: null,
        'pix_qrcode' => $qrCode ?: null
    ]
]);
