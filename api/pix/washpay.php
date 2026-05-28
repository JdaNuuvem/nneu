<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

define('WASHPAY_API_KEY', 'pk_cfaba8390414365c5b732fd953f6b5cce9d8b0e79488293571394bf5662bc436');
define('WASHPAY_BASE', 'https://washpay.com.br/api/user');

function wpRequest($method, $endpoint, $data = null, $extraHeaders = []) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WASHPAY_BASE . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HEADER, true);
    
    $headers = array_merge([
        'Authorization: Bearer ' . WASHPAY_API_KEY,
        'Content-Type: application/json'
    ], $extraHeaders);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($method === 'POST' && $data) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headersStr = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    curl_close($ch);
    
    // Extract cookies
    preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $headersStr, $matches);
    
    return [
        'status' => $httpCode,
        'data' => json_decode($body, true),
        'cookies' => $matches[1] ?? []
    ];
}

function wpFrontendPost($path, $data, $cookies = '') {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://washpay.com.br' . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0'
    ]);
    if ($cookies) curl_setopt($ch, CURLOPT_COOKIE, $cookies);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ['status' => $httpCode, 'data' => json_decode($response, true)];
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { echo json_encode(['success' => false, 'error' => 'Dados inválidos']); exit; }

$total = floatval($input['total'] ?? 0);
$items = $input['items'] ?? [];
$buyer = $input['buyer'] ?? [];

if ($total <= 0) { echo json_encode(['success' => false, 'error' => 'Valor inválido']); exit; }

$customerName = trim(($buyer['nomeCompleto'] ?? '') ?: (($buyer['nome'] ?? '') . ' ' . ($buyer['sobrenome'] ?? '')));
$customerEmail = $buyer['email'] ?? '';
$customerPhone = preg_replace('/[^0-9]/', '', $buyer['telefone'] ?? '');
$customerCpf = preg_replace('/[^0-9]/', '', $buyer['cpf'] ?? '');

$productName = 'Produto';
if (!empty($items)) {
    $names = [];
    foreach ($items as $item) { $n = $item['nome'] ?? $item['name'] ?? ''; if ($n) $names[] = $n; }
    if (!empty($names)) { $productName = implode(' + ', array_slice($names, 0, 3)); if (count($names) > 3) $productName .= ' e mais'; }
}

// 1. Criar produto
$pr = wpRequest('POST', '/products', ['name' => $productName, 'price' => $total]);
if (!$pr['data']['success']) { echo json_encode(['success' => false, 'error' => 'Erro ao criar produto']); exit; }
$productId = $pr['data']['data']['id'];

// 2. Criar payment link
$lr = wpRequest('POST', '/payment-links', ['title' => $productName, 'amount' => $total, 'productId' => $productId]);
if (!$lr['data']['success']) { echo json_encode(['success' => false, 'error' => 'Erro ao criar link']); exit; }
$linkId = $lr['data']['data']['id'];

// 3. Visitar página de pagamento para pegar cookie
$visitUrl = 'https://washpay.com.br/pay/' . $linkId;
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $visitUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
$resp = curl_exec($ch);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);
preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', substr($resp, 0, $headerSize), $cookieMatches);
$cookies = implode('; ', $cookieMatches[1] ?? []);

// 4. Criar order via frontend API
$webhookBase = rtrim(($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'), '/');
$postbackUrl = $webhookBase . '/api/pix/washpay-webhook.php';

$orderPayload = [
    'paymentLinkId' => $linkId,
    'customerName' => $customerName ?: 'Cliente',
    'customerEmail' => $customerEmail ?: 'cliente@email.com',
    'customerCpf' => $customerCpf ?: '12345678909',
    'customerPhone' => $customerPhone ?: '11999999999',
    'paymentMethod' => 'PIX',
    'postbackUrl' => $postbackUrl
];

$orderResult = wpFrontendPost('/api/orders', $orderPayload, $cookies);

if (!$orderResult['data']['success']) {
    echo json_encode(['success' => false, 'error' => $orderResult['data']['error'] ?? 'Erro ao criar pedido']);
    exit;
}

$orderData = $orderResult['data']['data'];
$orderId = $orderData['orderId'] ?? '';
$pixCode = $orderData['pix']['qr_code'] ?? $orderData['pix']['qrcode'] ?? '';
$qrImage = $orderData['pix']['image'] ?? '';

// Salvar
$txDir = __DIR__ . '/../../transactions';
if (!is_dir($txDir)) @mkdir($txDir, 0755, true);
file_put_contents("$txDir/washpay_{$orderId}.json", json_encode([
    'link_id' => $linkId, 'order_id' => $orderId, 'amount' => $total, 'status' => 'PENDING', 'created_at' => date('c')
]));

echo json_encode([
    'success' => true,
    'data' => [
        'transaction_id' => $orderId,
        'order_number' => $orderData['orderNumber'] ?? '',
        'pix_code' => $pixCode,
        'payload' => $pixCode,
        'qr_code' => $qrImage
    ]
]);
