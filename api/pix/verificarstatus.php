<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==================== CONFIGURAÇÕES ====================

define('API_BASE_URL', 'https://api.gateway.aurapagamento.com/functions/v1');
define('API_AUTH', 'Basic c2tfbGl2ZV9BTVRkZVdYOWFUV2hRUlh2Y1R6Y3pMVVBIVzdFUVd4UHc5WFlFV2lkT1g1NVd5WUw6MmM4YjcwMmYtMTcxMS00MmM1LWEzMTUtMGFiZjg4OGU4YjM1');
define('XTRACKY_API_URL', 'https://api.xtracky.com/api/integrations/api');
define('SENTINEL_API_KEY', 'sk_25fcb892d1b3fe7c57ee7bffcef94732707e491f48b380d0');
define('SENTINEL_EVENTS_URL', 'https://api.specterfilter.com/sentinel-bff/api/events');
define('DEBUG_MODE', true);

// ==================== FUNÇÕES PRINCIPAIS ====================

function logDebug($message, $data = null) {
    if (!DEBUG_MODE) return;
    
    $logFile = 'debug_log.txt';
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message";
    
    if ($data !== null) {
        $logMessage .= "\n" . print_r($data, true);
    }
    
    $logMessage .= "\n" . str_repeat('-', 80) . "\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
}

function makeApiRequest($endpoint, $method = 'GET', $data = null) {
    $url = API_BASE_URL . $endpoint;
    
    $headers = [
        'accept: application/json',
        'authorization: ' . API_AUTH,
        'Content-Type: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

/**
 * Envia evento para Sentinel API (server-side)
 */
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = ['status' => $httpCode, 'response' => $response];
    logDebug('Resposta Sentinel', $result);
    return $result;
}

/**
 * Envia evento para XTracky - Versão simplificada
 */
function sendToXTracky($orderId, $amount, $status, $trackingParams) {
    // Manter utm_source original (incluindo KW-)
    $utmSource = $trackingParams['utm_source'] ?? '';
    
    // Se não tiver utm_source, usar click_id ou direct
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
    
    logDebug('Enviando para XTracky', $data);
    
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
    
    $result = [
        'status' => $httpCode,
        'data' => json_decode($response, true),
        'error' => $curlError,
        'success' => ($httpCode >= 200 && $httpCode < 300)
    ];
    
    // Log detalhado
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'event_type' => $status === 'waiting_payment' ? 'PIX_GERADO' : 'PIX_PAGO',
        'request' => $data,
        'response' => $result
    ];
    
    file_put_contents('xtracky_log_' . date('Y-m-d') . '.log', 
        json_encode($logData, JSON_PRETTY_PRINT) . PHP_EOL, 
        FILE_APPEND
    );
    
    return $result;
}

function getLocalTransaction($transactionId) {
    if (!is_dir('transactions')) {
        return null;
    }
    
    $transactionFiles = glob('transactions/*.json');
    
    foreach ($transactionFiles as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        if (!$data) continue;
        
        // Procurar pelo ID da API ou local ID
        if (($data['api_transaction_id'] === $transactionId) || 
            ($data['local_id'] === $transactionId) ||
            (isset($data['external_id']) && $data['external_id'] === $transactionId)) {
            return $data;
        }
    }
    
    return null;
}

function updateLocalTransaction($transactionId, $apiData) {
    if (!is_dir('transactions')) {
        mkdir('transactions', 0755, true);
    }
    
    $transactionFiles = glob('transactions/*.json');
    
    foreach ($transactionFiles as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        if (!$data) continue;
        
        if ($data['api_transaction_id'] === $transactionId) {
            $oldStatus = $data['status'] ?? 'waiting_payment';
            $newStatus = $apiData['status'] ?? 'waiting_payment';
            
            $data['previous_status'] = $oldStatus;
            $data['status'] = $newStatus;
            $data['updated_at'] = date('Y-m-d H:i:s');
            $data['paid_amount'] = $apiData['paidAmount'] ?? 0;
            
            if (isset($apiData['paidAt'])) {
                $data['paid_at'] = $apiData['paidAt'];
            }
            
            // Atualizar arquivo
            file_put_contents($file, 
                json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
            
            return [
                'data' => $data,
                'status_changed' => ($oldStatus !== $newStatus),
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ];
        }
    }
    
    return null;
}

function markXTrackyPaidSent($transactionId, $xTrackyResult = null) {
    if (!is_dir('transactions')) {
        return false;
    }
    
    $transactionFiles = glob('transactions/*.json');
    
    foreach ($transactionFiles as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        
        if (!$data) continue;
        
        if ($data['api_transaction_id'] === $transactionId) {
            $data['xtracky_paid_sent'] = true;
            $data['xtracky_paid_sent_at'] = date('Y-m-d H:i:s');
            
            if ($xTrackyResult) {
                $data['xtracky_paid_response'] = [
                    'status' => $xTrackyResult['status'] ?? null,
                    'sent_at' => date('Y-m-d H:i:s'),
                    'success' => $xTrackyResult['success'],
                    'data' => $xTrackyResult['data'] ?? null
                ];
                
                // Adicionar ao histórico de eventos
                if (!isset($data['xtracky_events'])) {
                    $data['xtracky_events'] = [];
                }
                
                $data['xtracky_events'][] = [
                    'type' => 'paid',
                    'sent_at' => date('Y-m-d H:i:s'),
                    'success' => $xTrackyResult['success'],
                    'response' => $xTrackyResult
                ];
            }
            
            file_put_contents($file, 
                json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
            return true;
        }
    }
    
    return false;
}

function mapStatus($apiStatus) {
    $statusMap = [
        'WAITING_PAYMENT' => 'waiting_payment',
        'PENDING' => 'waiting_payment',
        'PROCESSING' => 'waiting_payment',
        'APPROVED' => 'paid',
        'PAID' => 'paid',
        'COMPLETED' => 'paid',
        'CONFIRMED' => 'paid',
        'SETTLED' => 'paid',
        'REFUNDED' => 'refunded',
        'CANCELED' => 'canceled',
        'CANCELLED' => 'canceled',
        'EXPIRED' => 'expired',
        'FAILED' => 'failed'
    ];
    
    $upperStatus = strtoupper($apiStatus);
    return $statusMap[$upperStatus] ?? strtolower($apiStatus);
}

// ==================== PROCESSAR REQUISIÇÃO ====================

try {
    // Obter external_id (order_id local) ou transaction_id da query string ou POST
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $transactionId = $input['external_id'] ?? $input['id'] ?? $input['transaction_id'] ?? '';
    } else {
        $transactionId = $_GET['external_id'] ?? $_GET['transaction_id'] ?? $_GET['id'] ?? '';
    }
    
    if (empty($transactionId)) {
        echo json_encode([
            'success' => false,
            'error' => 'external_id ou transaction_id é obrigatório'
        ]);
        exit;
    }
    
    logDebug('Verificando status da transação', ['transaction_id' => $transactionId]);
    
    // Se for external_id (order_id local), buscar transação local para obter api_transaction_id
    $localTransaction = getLocalTransaction($transactionId);
    $apiTransactionId = $transactionId;
    if ($localTransaction && isset($localTransaction['api_transaction_id'])) {
        $apiTransactionId = $localTransaction['api_transaction_id'];
    }
    
    // Buscar transação na API (usar api_transaction_id)
    $response = makeApiRequest('/transactions/' . $apiTransactionId, 'GET');
    
    if ($response['status'] === 200 && isset($response['data']['id'])) {
        $transactionData = $response['data'];
        $apiStatus = $transactionData['status'] ?? 'waiting_payment';
        $mappedStatus = mapStatus($apiStatus);
        
        logDebug('Status da API', [
            'original' => $apiStatus, 
            'mapped' => $mappedStatus,
            'full_data' => $transactionData
        ]);
        
        // Buscar transação local (já obtida acima, ou por api_transaction_id)
        if (!$localTransaction) {
            $localTransaction = getLocalTransaction($apiTransactionId);
        }
        
        $statusChanged = false;
        $xTrackyResult = null;
        
        if ($localTransaction) {
            $previousStatus = $localTransaction['status'] ?? 'waiting_payment';
            $alreadySent = $localTransaction['xtracky_paid_sent'] ?? false;
            
            // Atualizar status local (usar api_transaction_id)
            $updateResult = updateLocalTransaction($apiTransactionId, $transactionData);
            $statusChanged = $updateResult['status_changed'] ?? false;
            
            // Verificar se mudou para PAGO
            $wasWaiting = in_array($previousStatus, ['waiting_payment', 'pending', 'processing']);
            $nowPaid = in_array($mappedStatus, ['paid', 'approved', 'completed', 'confirmed', 'settled']);
            
            logDebug('Verificação de status', [
                'was_waiting' => $wasWaiting,
                'now_paid' => $nowPaid,
                'previous_status' => $previousStatus,
                'current_status' => $mappedStatus,
                'already_sent' => $alreadySent,
                'status_changed' => $statusChanged
            ]);
            
            // ========== ENVIAR EVENTO "PIX PAGO" PARA XTRACKY ==========
            if ($wasWaiting && $nowPaid && !$alreadySent) {
                logDebug('✅ Status mudou para PAGO! Enviando para XTracky...');
                
                // Obter dados para envio
                $orderId = $localTransaction['local_id'] ?? $localTransaction['external_id'] ?? $transactionId;
                $amount = $localTransaction['total_amount_cents'] ?? $transactionData['amount'] ?? 0;
                $trackingParams = $localTransaction['tracking_params'] ?? [];
                
                // IMPORTANTE: Usar o utm_source ORIGINAL (com KW-)
                if (isset($trackingParams['utm_source']) && !empty($trackingParams['utm_source'])) {
                    // Já tem utm_source, manter como está
                } elseif (isset($transactionData['metadata']['utm_source'])) {
                    // Pegar do metadata da API
                    $trackingParams['utm_source'] = $transactionData['metadata']['utm_source'];
                }
                
                logDebug('Dados para XTracky (paid)', [
                    'orderId' => $orderId,
                    'amount' => $amount,
                    'tracking_params' => $trackingParams
                ]);
                
                // Enviar para XTracky com status "paid"
                $xTrackyResult = sendToXTracky($orderId, $amount, 'paid', $trackingParams);
                
                logDebug('Resultado XTracky (paid)', $xTrackyResult);
                
                // Marcar como enviado
                if ($xTrackyResult['success']) {
                    markXTrackyPaidSent($apiTransactionId, $xTrackyResult);
                    logDebug('✅ Evento de pagamento enviado com sucesso para XTracky');
                } else {
                    logDebug('❌ ERRO ao enviar para XTracky', $xTrackyResult);
                }

                // Enviar purchase para Sentinel (server-side)
                $customerName = $localTransaction['buyer']['nome'] ?? '';
                if (!empty($localTransaction['buyer']['sobrenome'])) {
                    $customerName .= ' ' . $localTransaction['buyer']['sobrenome'];
                }
                $sentinelPayload = [
                    'value' => (float)($amount / 100),
                    'currency' => 'BRL',
                    'order_id' => $orderId,
                    'shipping_amount' => 0,
                    'items' => [['id' => 'item', 'name' => 'Produto', 'quantity' => 1, 'price' => (float)($amount / 100)]]
                ];
                if (!empty($customerName) || !empty($localTransaction['buyer']['email'])) {
                    $sentinelPayload['customer'] = [
                        'name' => $customerName,
                        'email' => $localTransaction['buyer']['email'] ?? '',
                        'phone' => $localTransaction['buyer']['telefone'] ?? ''
                    ];
                }
                $sentinelResult = sendToSentinel('init_checkout', $sentinelPayload);
                logDebug('Sentinel init_checkout enviado', $sentinelResult);
                $sentinelResult = sendToSentinel('purchase', $sentinelPayload);
                logDebug('Sentinel purchase enviado', $sentinelResult);
                
            } elseif ($alreadySent) {
                logDebug('ℹ️ Evento de pagamento já foi enviado anteriormente');
            }
        } else {
            logDebug('⚠️ Transação local não encontrada para: ' . $transactionId);
        }
        
        // Preparar resposta
        $responseData = [
            'transaction_id' => $transactionData['id'],
            'order_id' => $transactionData['metadata']['order_id'] ?? '',
            'status' => $mappedStatus,
            'original_status' => $apiStatus,
            'total_amount' => $transactionData['amount'] ?? 0,
            'paid_amount' => $transactionData['paidAmount'] ?? 0,
            'payment_method' => $transactionData['paymentMethod'] ?? 'PIX',
            'created_at' => $transactionData['createdAt'] ?? '',
            'updated_at' => $transactionData['updatedAt'] ?? '',
            'paid_at' => $transactionData['paidAt'] ?? null,
            'pix_qrcode' => $transactionData['pix']['qrcode'] ?? '',
            'pix_expiration' => $transactionData['pix']['expirationDate'] ?? ''
        ];
        
        $isPaid = in_array($mappedStatus, ['paid', 'approved', 'completed', 'confirmed', 'settled']);
        $redirectUrl = $isPaid ? '../sucesso.html' : '';
        
        $finalResponse = [
            'success' => true,
            'paid' => $isPaid,
            'redirect_url' => $redirectUrl,
            'data' => $responseData,
            'status_changed' => $statusChanged
        ];
        
        if ($redirectUrl) {
            $finalResponse['redirect'] = $redirectUrl;
        }
        
        // Adicionar informações do XTracky
        if ($xTrackyResult !== null) {
            $finalResponse['xtracky'] = [
                'sent' => $xTrackyResult['success'],
                'status' => $xTrackyResult['status'],
                'message' => $xTrackyResult['success'] ? 
                    'Evento de pagamento enviado para XTracky' : 
                    'Erro ao enviar para XTracky'
            ];
        }
        
        // Adicionar tracking se disponível
        if ($localTransaction && isset($localTransaction['tracking_params'])) {
            $finalResponse['tracking'] = [
                'utm_source' => $localTransaction['tracking_params']['utm_source'] ?? '',
                'click_id' => $localTransaction['tracking_params']['click_id'] ?? ''
            ];
        }
        
        logDebug('Resposta final', $finalResponse);
        
        echo json_encode($finalResponse);
        
    } else if ($response['status'] === 404) {
        echo json_encode([
            'success' => false,
            'error' => 'Transação não encontrada na API'
        ]);
    } else {
        $errorMsg = $response['data']['error'] ?? $response['data']['message'] ?? 'Erro ao consultar transação';
        echo json_encode([
            'success' => false,
            'error' => $errorMsg,
            'http_status' => $response['status']
        ]);
    }
    
} catch (Exception $e) {
    logDebug('EXCEÇÃO', [
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
    
    echo json_encode([
        'success' => false,
        'error' => 'Erro interno: ' . $e->getMessage()
    ]);
}
?>