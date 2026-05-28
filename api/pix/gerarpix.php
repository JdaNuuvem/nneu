<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==================== CONFIGURAÇÕES ====================

// Configurações da API AuraPay
define('API_BASE_URL', 'https://api.gateway.aurapagamento.com/functions/v1');
define('API_AUTH', 'Basic c2tfbGl2ZV9BTVRkZVdYOWFUV2hRUlh2Y1R6Y3pMVVBIVzdFUVd4UHc5WFlFV2lkT1g1NVd5WUw6MmM4YjcwMmYtMTcxMS00MmM1LWEzMTUtMGFiZjg4OGU4YjM1');

// Configurações XTracky
define('XTRACKY_API_URL', 'https://api.xtracky.com/api/integrations/api');

// ==================== FUNÇÕES AUXILIARES ====================

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
    
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

function captureTrackingParams($input) {
    $tracking = [
        'utm_source' => '',
        'utm_medium' => '',
        'utm_campaign' => '',
        'utm_term' => '',
        'utm_content' => '',
        'click_id' => '',
        'fbclid' => '',
        'gclid' => '',
        'ttclid' => '',
        'kwai_click_id' => '',
        'all_params' => []
    ];
    
    $params = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'click_id', 'fbclid', 'gclid', 'ttclid', 'kwai_click_id',
        'utm_id', 'utm_source_platform', 'fbp', 'fbc'
    ];
    
    // Capturar do payload enviado
    foreach ($params as $param) {
        if (isset($input[$param]) && !empty($input[$param])) {
            $tracking[$param] = $input[$param];
            $tracking['all_params'][$param] = $input[$param];
        }
    }
    
    // Se não veio no payload, tentar capturar da query string
    foreach ($params as $param) {
        if (empty($tracking[$param]) && isset($_GET[$param]) && !empty($_GET[$param])) {
            $tracking[$param] = $_GET[$param];
            $tracking['all_params'][$param] = $_GET[$param];
        }
    }
    
    return $tracking;
}

/**
 * Envia conversão para XTracky - CORRIGIDO: Mantém utm_source original
 */
function sendToXTracky($orderId, $amount, $status, $trackingParams) {
    // IMPORTANTE: Manter o utm_source ORIGINAL (incluindo KW-)
    $utmSource = $trackingParams['utm_source'] ?? '';
    
    // Se não tiver utm_source, tentar usar click_id
    if (empty($utmSource)) {
        if (!empty($trackingParams['click_id'])) {
            $utmSource = $trackingParams['click_id'];
        } else {
            $utmSource = 'direct';
        }
    }
    
    // Preparar dados conforme documentação da XTracky
    $data = [
        'orderId' => $orderId,
        'amount' => $amount, // Valor em centavos
        'status' => $status, // 'waiting_payment' ou 'paid'
        'utm_source' => $utmSource // Mantém o valor original
    ];
    
    // Log para debug
    file_put_contents('xtracky_requests.log', 
        date('Y-m-d H:i:s') . " - Sending to XTracky:\n" . 
        json_encode($data, JSON_PRETTY_PRINT) . "\n\n", 
        FILE_APPEND
    );
    
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
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    $result = [
        'timestamp' => date('Y-m-d H:i:s'),
        'event_type' => $status === 'waiting_payment' ? 'PIX_GERADO' : 'PIX_PAGO',
        'request' => $data,
        'response' => [
            'status' => $httpCode,
            'body' => json_decode($response, true),
            'error' => $curlError
        ],
        'success' => ($httpCode >= 200 && $httpCode < 300)
    ];
    
    // Log para arquivo diário
    file_put_contents('xtracky_log_' . date('Y-m-d') . '.log', 
        json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL, 
        FILE_APPEND
    );
    
    return $result;
}

/**
 * Função auxiliar para enviar evento async (não bloqueia a resposta)
 */
function sendToXTrackyAsync($orderId, $amount, $status, $trackingParams) {
    // Criar dados para fila
    $eventData = [
        'orderId' => $orderId,
        'amount' => $amount,
        'status' => $status,
        'trackingParams' => $trackingParams,
        'timestamp' => time(),
        'attempts' => 0
    ];
    
    // Salvar na fila de eventos
    $queueFile = 'xtracky_queue.json';
    $queue = [];
    
    if (file_exists($queueFile)) {
        $queue = json_decode(file_get_contents($queueFile), true) ?: [];
    }
    
    $queue[] = $eventData;
    file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));
    
    return true;
}

function saveTransactionLocally($apiResponse, $inputData, $amountInReais, $trackingParams) {
    if (!is_dir('transactions')) {
        mkdir('transactions', 0755, true);
    }
    
    $orderId = $inputData['order_id'] ?? ('ORDER_' . time() . '_' . uniqid());
    
    $transactionData = [
        'local_id' => $orderId,
        'api_transaction_id' => $apiResponse['id'],
        'external_id' => $orderId,
        'status' => $apiResponse['status'] ?? 'waiting_payment',
        'total_amount_reais' => $amountInReais,
        'total_amount_cents' => $apiResponse['amount'] ?? 0,
        'buyer' => $inputData['buyer'] ?? [],
        'shipping' => $inputData['shipping'] ?? [],
        'items' => $inputData['items'] ?? [],
        'tracking_params' => $trackingParams,
        'pix_data' => $apiResponse['pix'] ?? [],
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
        'xtracky_waiting_sent' => false,
        'xtracky_paid_sent' => false,
        'xtracky_events' => []
    ];
    
    $filename = 'transactions/' . $orderId . '.json';
    file_put_contents($filename, json_encode($transactionData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    
    return $transactionData;
}

// ==================== PROCESSAR REQUISIÇÃO ====================

try {
    $input = isset($GLOBALS['gerarpix_input']) ? $GLOBALS['gerarpix_input'] : json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode([
            'success' => false,
            'error' => 'Dados inválidos ou vazios'
        ]);
        exit;
    }
    
    // Capturar parâmetros de tracking
    $trackingParams = captureTrackingParams($input);
    
    // Log dos parâmetros capturados
    $trackingLog = [
        'timestamp' => date('Y-m-d H:i:s'),
        'captured_params' => $trackingParams,
        'input_params' => $input
    ];
    file_put_contents('tracking_log_' . date('Y-m-d') . '.log', 
        json_encode($trackingLog, JSON_PRETTY_PRINT) . PHP_EOL, 
        FILE_APPEND
    );
    
    // Processar itens
    $apiItems = [];
    $totalAmountInReais = 0;
    
    foreach ($input['items'] ?? [] as $item) {
        $itemTitle = $item['nome'] ?? $item['name'] ?? $item['title'] ?? 'Produto';
        $unitPriceInReais = 0;
        
        if (isset($item['preço']) && is_numeric($item['preço'])) {
            $unitPriceInReais = floatval($item['preço']);
        } elseif (isset($item['price']) && is_numeric($item['price'])) {
            $unitPriceInReais = floatval($item['price']);
        } elseif (isset($item['preco']) && is_numeric($item['preco'])) {
            $unitPriceInReais = floatval($item['preco']);
        }
        
        $quantity = intval($item['quantidade'] ?? $item['quantity'] ?? 1);
        $itemTotalInReais = $unitPriceInReais * $quantity;
        $totalAmountInReais += $itemTotalInReais;
        
        $unitPriceInCents = intval(round($unitPriceInReais * 100));
        
        $apiItems[] = [
            'title' => substr($itemTitle, 0, 100),
            'unitPrice' => $unitPriceInCents,
            'quantity' => $quantity
        ];
    }
    
    $totalFromPayload = floatval($input['total'] ?? $input['subtotal'] ?? 0);
    $finalTotalInReais = $totalFromPayload > 0 ? $totalFromPayload : $totalAmountInReais;
    $amountInCents = intval(round($finalTotalInReais * 100));
    
    // Preparar dados do cliente
    $buyer = $input['buyer'] ?? [];
    $customer = [
        'name' => trim(substr($buyer['nomeCompleto'] ?? 
            (($buyer['nome'] ?? '') . ' ' . ($buyer['sobrenome'] ?? '')), 0, 100)),
        'email' => $buyer['email'] ?? '',
        'phone' => preg_replace('/[^0-9]/', '', $buyer['telefone'] ?? ''),
        'document' => [
            'number' => preg_replace('/[^0-9]/', '', $buyer['cpf'] ?? '')
        ]
    ];
    
    // Validar dados obrigatórios
    $errors = [];
    if (empty($customer['name'])) $errors[] = 'Nome é obrigatório';
    if (empty($customer['email'])) $errors[] = 'Email é obrigatório';
    if (empty($customer['phone'])) $errors[] = 'Telefone é obrigatório';
    if (empty($customer['document']['number'])) $errors[] = 'CPF é obrigatório';
    if ($amountInCents <= 0) $errors[] = 'Valor total deve ser maior que zero';
    
    if (!empty($errors)) {
        echo json_encode([
            'success' => false,
            'error' => 'Dados inválidos: ' . implode(', ', $errors)
        ]);
        exit;
    }
    
    // Criar payload para a API AuraPay
    $orderId = $input['order_id'] ?? ('ORDER_' . time() . '_' . uniqid());
    
    $transactionData = [
        'customer' => $customer,
        'paymentMethod' => 'PIX',
        'items' => $apiItems,
        'amount' => $amountInCents
    ];
    
    // Adicionar metadata
    $metadata = ['order_id' => $orderId];
    foreach ($trackingParams['all_params'] as $key => $value) {
        if (!empty($value)) {
            $metadata[$key] = $value;
        }
    }
    
    if (!empty($metadata)) {
        $transactionData['metadata'] = $metadata;
    }
    
    // Adicionar shipping se existir
    if (isset($input['shipping']) && is_array($input['shipping'])) {
        $shipping = $input['shipping'];
        $transactionData['shipping'] = [
            'address' => [
                'street' => $shipping['logradouro'] ?? $shipping['street'] ?? '',
                'number' => $shipping['numero'] ?? $shipping['number'] ?? '',
                'complement' => $shipping['complemento'] ?? $shipping['complement'] ?? '',
                'neighborhood' => $shipping['bairro'] ?? $shipping['neighborhood'] ?? '',
                'city' => $shipping['cidade'] ?? $shipping['city'] ?? '',
                'state' => $shipping['estado'] ?? $shipping['state'] ?? '',
                'postalCode' => preg_replace('/[^0-9]/', '', $shipping['cep'] ?? $shipping['postalCode'] ?? '')
            ]
        ];
    }
    
    // Enviar para a API AuraPay
    $response = makeApiRequest('/transactions', 'POST', $transactionData);
    
    if ($response['status'] === 200 && isset($response['data']['id'])) {
        $responseData = $response['data'];
        $amountInReais = $responseData['amount'] / 100;
        
        // Salvar transação localmente
        $localTransaction = saveTransactionLocally($responseData, $input, $amountInReais, $trackingParams);
        
        // ========== ENVIAR EVENTO "PIX GERADO" PARA XTRACKY ==========
        $xTrackyResult = sendToXTracky(
            $orderId,
            $amountInCents,
            'waiting_payment',
            $trackingParams
        );
        
        // Também enviar async para garantir
        sendToXTrackyAsync($orderId, $amountInCents, 'waiting_payment', $trackingParams);
        
        // Atualizar transação local
        $transactionFile = 'transactions/' . $orderId . '.json';
        if (file_exists($transactionFile)) {
            $updatedTransaction = json_decode(file_get_contents($transactionFile), true);
            $updatedTransaction['xtracky_waiting_sent'] = $xTrackyResult['success'];
            $updatedTransaction['xtracky_waiting_sent_at'] = date('Y-m-d H:i:s');
            $updatedTransaction['xtracky_waiting_response'] = $xTrackyResult;
            
            // Adicionar ao histórico de eventos
            $updatedTransaction['xtracky_events'][] = [
                'type' => 'waiting_payment',
                'sent_at' => date('Y-m-d H:i:s'),
                'success' => $xTrackyResult['success'],
                'response' => $xTrackyResult['response']
            ];
            
            file_put_contents($transactionFile, 
                json_encode($updatedTransaction, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
        }
        
        // Preparar resposta
        $pixData = [
            'transaction_id' => $responseData['id'],
            'order_id' => $orderId,
            'pix_code' => $responseData['pix']['qrcode'] ?? '',
            'qr_code' => isset($responseData['pix']['qrcode']) ? 
                'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' . urlencode($responseData['pix']['qrcode']) : '',
            'status' => $responseData['status'] ?? 'waiting_payment',
            'total_value' => $amountInReais,
            'total_value_cents' => $responseData['amount'],
            'expiration_date' => $responseData['pix']['expirationDate'] ?? ''
        ];
        
        echo json_encode([
            'success' => true,
            'message' => 'PIX gerado com sucesso',
            'data' => $pixData,
            'tracking' => [
                'utm_source' => $trackingParams['utm_source'],
                'click_id' => $trackingParams['click_id']
            ],
            'xtracky' => [
                'sent' => $xTrackyResult['success'],
                'status' => $xTrackyResult['response']['status'],
                'message' => $xTrackyResult['response']['body']['message'] ?? 'Evento enviado'
            ]
        ]);
        
    } else {
        $errorMsg = $response['data']['error'] ?? $response['data']['message'] ?? 'Erro ao criar transação';
        
        echo json_encode([
            'success' => false,
            'error' => $errorMsg,
            'api_response' => $response['data'],
            'http_status' => $response['status']
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Erro interno: ' . $e->getMessage()
    ]);
}
?>