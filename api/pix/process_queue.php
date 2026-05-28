<?php
// Script para processar eventos pendentes da XTracky
// Executar via cron a cada 5 minutos: */5 * * * * php /caminho/para/process_queue.php

define('XTRACKY_API_URL', 'https://api.xtracky.com/api/integrations/api');

function sendToXTracky($orderId, $amount, $status, $trackingParams) {
    $utmSource = $trackingParams['utm_source'] ?? '';
    
    if (empty($utmSource)) {
        if (!empty($trackingParams['click_id'])) {
            $utmSource = $trackingParams['click_id'];
        } else {
            $utmSource = 'direct';
        }
    }
    
    $data = [
        'orderId' => (string)$orderId,
        'amount' => (int)$amount,
        'status' => $status,
        'utm_source' => $utmSource
    ];
    
    $headers = [
        'Content-Type: application/json',
        'Accept: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, XTRACKY_API_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'success' => ($httpCode >= 200 && $httpCode < 300),
        'error' => $curlError,
        'data' => json_decode($response, true)
    ];
}

// Processar fila
$queueFile = 'xtracky_queue.json';
if (!file_exists($queueFile)) {
    exit;
}

$queue = json_decode(file_get_contents($queueFile), true) ?: [];
$processed = [];
$failed = [];

foreach ($queue as $index => $event) {
    if ($event['attempts'] >= 3) {
        // Muitas tentativas, marcar como falha permanente
        $failed[] = $event;
        continue;
    }
    
    // Enviar evento
    $result = sendToXTracky(
        $event['orderId'],
        $event['amount'],
        $event['status'],
        $event['trackingParams']
    );
    
    if ($result['success']) {
        $processed[] = $event;
    } else {
        // Incrementar tentativas e manter na fila
        $queue[$index]['attempts']++;
        $queue[$index]['last_attempt'] = time();
    }
    
    // Pequena pausa para não sobrecarregar
    usleep(100000); // 100ms
}

// Atualizar fila
file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));

// Log de processamento
if (!empty($processed) || !empty($failed)) {
    $log = [
        'timestamp' => date('Y-m-d H:i:s'),
        'processed' => count($processed),
        'failed' => count($failed),
        'remaining' => count($queue)
    ];
    
    file_put_contents('queue_log_' . date('Y-m-d') . '.log', 
        json_encode($log, JSON_PRETTY_PRINT) . PHP_EOL, 
        FILE_APPEND
    );
}
?>