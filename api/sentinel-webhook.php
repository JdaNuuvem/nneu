<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

define('SENTINEL_API_KEY', 'sk_25fcb892d1b3fe7c57ee7bffcef94732707e491f48b380d0');
define('SENTINEL_EVENTS_URL', 'https://api.specterfilter.com/sentinel-bff/api/events');
define('SENTINEL_WEBHOOK_URL', 'https://api.specterfilter.com/sentinel-bff/api/webhooks?public_key=' . SENTINEL_API_KEY);
define('DEBUG_MODE', true);

function logDebug($msg, $data = null) {
    if (!DEBUG_MODE) return;
    $log = '[' . date('Y-m-d H:i:s') . '] ' . $msg . ($data ? "\n" . print_r($data, true) : '') . "\n" . str_repeat('-', 60) . "\n";
    file_put_contents('sentinel_webhook.log', $log, FILE_APPEND);
}

function sendToSentinel($eventName, $payload = []) {
    $data = [
        'api_key' => SENTINEL_API_KEY,
        'event_name' => $eventName,
        'event_id' => 'srv_' . date('YmdHis') . '_' . substr(uniqid(), -6),
        'visitor_id' => 'server_' . ($payload['customer']['email'] ?? 'anon'),
        'data' => $payload
    ];

    logDebug('Enviando para Sentinel API', $data);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, SENTINEL_EVENTS_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $result = ['status' => $httpCode, 'response' => $response, 'error' => $error];
    logDebug('Resposta Sentinel', $result);
    return $result;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $event = $_GET['event'] ?? $input['event'] ?? '';

    if (empty($event)) {
        echo json_encode(['success' => false, 'error' => 'event é obrigatório']);
        exit;
    }

    $allowedEvents = ['page_view', 'add_to_cart', 'init_checkout', 'purchase', 'complete_registration', 'completed_register', 'login', 'subscribe'];
    if (!in_array($event, $allowedEvents)) {
        echo json_encode(['success' => false, 'error' => 'evento inválido: ' . $event]);
        exit;
    }

    $payload = $input['payload'] ?? [];

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $result = sendToSentinel($event, $payload);
        echo json_encode([
            'success' => $result['status'] >= 200 && $result['status'] < 300,
            'event' => $event,
            'sentinel_status' => $result['status'],
            'sentinel_response' => $result['response']
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Webhook Sentinel ativo',
            'pixel_id' => SENTINEL_PIXEL_ID,
            'endpoints' => [
                'eventos' => 'POST com JSON { "event": "event_name", "payload": { ... } }',
                'teste' => 'GET ?event=page_view para testar'
            ],
            'eventos_suportados' => $allowedEvents
        ]);
    }

} catch (Exception $e) {
    logDebug('ERRO', $e->getMessage());
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
