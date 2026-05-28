<?php
/**
 * Roteador da API PIX para o checkout (action=create → gerarpix, action=status → verificarstatus).
 * O checkout.js envia payload com value, name, document, email, phone; gerarpix espera buyer, items, total.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = $_GET['action'] ?? '';

if ($action === 'status') {
    $externalId = $_GET['external_id'] ?? $_GET['transaction_id'] ?? $_GET['id'] ?? '';
    if ($externalId === '') {
        echo json_encode(['success' => false, 'error' => 'external_id é obrigatório']);
        exit;
    }
    $_GET['external_id'] = $externalId;
    include __DIR__ . '/verificarstatus.php';
    exit;
}

if ($action === 'create') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!$body || !isset($body['value']) || !isset($body['name'])) {
        echo json_encode(['success' => false, 'error' => 'Dados inválidos (value e name obrigatórios)']);
        exit;
    }
    $name = trim($body['name']);
    $parts = preg_split('/\s+/', $name, 2);
    $nome = $parts[0] ?? '';
    $sobrenome = $parts[1] ?? '';
    $tracking = $body['tracking'] ?? [];
    $gerarpixInput = [
        'buyer' => [
            'nome' => $nome,
            'sobrenome' => $sobrenome,
            'email' => $body['email'] ?? '',
            'telefone' => preg_replace('/\D/', '', $body['phone'] ?? ''),
            'cpf' => preg_replace('/\D/', '', $body['document'] ?? '')
        ],
        'items' => [
            ['name' => 'Produto', 'price' => floatval($body['value']), 'quantity' => 1]
        ],
        'total' => floatval($body['value']),
        'utm_source' => $tracking['utm_source'] ?? '',
        'utm_medium' => $tracking['utm_medium'] ?? '',
        'utm_campaign' => $tracking['utm_campaign'] ?? '',
        'utm_content' => $tracking['utm_content'] ?? '',
        'utm_term' => $tracking['utm_term'] ?? '',
        'click_id' => $tracking['click_id'] ?? '',
        'fbclid' => $tracking['fbclid'] ?? '',
        'gclid' => $tracking['gclid'] ?? '',
        'ttclid' => $tracking['ttclid'] ?? ''
    ];
    $GLOBALS['gerarpix_input'] = $gerarpixInput;
    ob_start();
    include __DIR__ . '/gerarpix.php';
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    if ($decoded && !empty($decoded['success']) && !empty($decoded['data'])) {
        $d = $decoded['data'];
        echo json_encode([
            'success' => true,
            'pix_code' => $d['pix_code'] ?? '',
            'qr_code_base64' => $d['qr_code'] ?? '',
            'external_id' => $d['order_id'] ?? '',
            'amount' => $d['total_value'] ?? 0
        ]);
    } else {
        echo $out;
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'action inválida (use create ou status)']);
