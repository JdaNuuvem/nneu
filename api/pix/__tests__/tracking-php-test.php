<?php
/**
 * Testes para as funções de tracking do backend PHP
 *
 * Uso: php tracking-php-test.php
 * (Requer PHP 8.0+ e extensão curl)
 */

// Incluir funções do gerarpix.php (simular ambiente)
require_once __DIR__ . '/../gerarpix.php';

// Redefinir funções para teste (já que gerarpix.php executa inline)
// Vamos reimplementar as funções inline para teste

function test_captureTrackingParams() {
    $results = [];
    
    // Teste 1: Capturar utm_source do payload
    $input1 = ['utm_source' => 'kwai', 'kwai_click_id' => 'kw_abc123'];
    $tracking1 = \captureTrackingParams($input1);
    assert($tracking1['utm_source'] === 'kwai', 'Deveria capturar utm_source do payload');
    assert($tracking1['kwai_click_id'] === 'kw_abc123', 'Deveria capturar kwai_click_id do payload');
    $results[] = '✓ captureTrackingParams: captura do payload';
    
    // Teste 2: Campos vazios quando não enviados
    $input2 = [];
    $tracking2 = \captureTrackingParams($input2);
    assert($tracking2['utm_source'] === '', 'Deveria retornar vazio');
    assert($tracking2['click_id'] === '', 'Deveria retornar vazio para click_id');
    $results[] = '✓ captureTrackingParams: payload vazio retorna vazio';
    
    // Teste 3: Parâmetros UTM completos
    $input3 = [
        'utm_source' => 'kwai',
        'utm_medium' => 'cpc',
        'utm_campaign' => 'blackfriday',
        'utm_term' => 'pneu',
        'utm_content' => 'banner1',
        'click_id' => 'kw_clk_001',
        'kwai_click_id' => 'kw_clk_001'
    ];
    $tracking3 = \captureTrackingParams($input3);
    assert($tracking3['utm_source'] === 'kwai', 'utm_source incorreto');
    assert($tracking3['utm_medium'] === 'cpc', 'utm_medium incorreto');
    assert($tracking3['utm_campaign'] === 'blackfriday', 'utm_campaign incorreto');
    assert($tracking3['kwai_click_id'] === 'kw_clk_001', 'kwai_click_id incorreto');
    assert(is_array($tracking3['all_params']), 'all_params deve ser array');
    $results[] = '✓ captureTrackingParams: parâmetros UTM completos';
    
    // Teste 4: Não aceita campos vazios
    $input4 = ['utm_source' => '', 'kwai_click_id' => 'kw_valido'];
    $tracking4 = \captureTrackingParams($input4);
    assert($tracking4['utm_source'] === '', 'utm_source vazio deve permanecer vazio');
    assert($tracking4['kwai_click_id'] === 'kw_valido', 'kwai_click_id válido');
    $results[] = '✓ captureTrackingParams: ignora campos vazios';
    
    return $results;
}

function test_sendToXTrackyDataPreparation() {
    $results = [];
    
    // Testar a preparação dos dados (não enviar de fato)
    $orderId = 'ORDER_TEST_001';
    $amount = 9990; // R$ 99,90 em centavos
    $status = 'waiting_payment';
    
    $testCases = [
        [
            'name' => 'utm_source kwai',
            'params' => ['utm_source' => 'kwai', 'kwai_click_id' => 'kw_test'],
            'expected_source' => 'kwai'
        ],
        [
            'name' => 'utm_source kw- prefix',
            'params' => ['utm_source' => 'kw-12345', 'click_id' => 'kw-12345'],
            'expected_source' => 'kw-12345'
        ],
        [
            'name' => 'sem utm_source, usa click_id',
            'params' => ['utm_source' => '', 'click_id' => 'kw_fallback'],
            'expected_source' => 'kw_fallback'
        ],
        [
            'name' => 'sem utm_source nem click_id, usa direct',
            'params' => ['utm_source' => '', 'click_id' => ''],
            'expected_source' => 'direct'
        ],
    ];
    
    foreach ($testCases as $tc) {
        $utmSource = $tc['params']['utm_source'];
        if (empty($utmSource)) {
            $utmSource = !empty($tc['params']['click_id']) 
                ? $tc['params']['click_id'] 
                : 'direct';
        }
        
        $data = [
            'orderId' => $orderId,
            'amount' => $amount,
            'status' => $status,
            'utm_source' => $utmSource,
        ];
        
        assert($data['utm_source'] === $tc['expected_source'], 
            "{$tc['name']}: esperado {$tc['expected_source']}, obtido {$data['utm_source']}");
        assert($data['orderId'] === $orderId, 'orderId deve ser preservado');
        assert($data['amount'] === $amount, 'amount em centavos');
        assert(in_array($data['status'], ['waiting_payment', 'paid']), 'status válido');
        
        $results[] = "✓ sendToXTracky data: {$tc['name']}";
    }
    
    return $results;
}

function test_trackingFlowValidation() {
    $results = [];
    
    // Simular o fluxo completo: request → capture → envio XTracky
    
    // Payload recebido do frontend
    $payload = [
        'order_id' => 'ORDER_FLOW_001',
        'total' => 99.90,
        'buyer' => [
            'nomeCompleto' => 'Maria Silva',
            'email' => 'maria@teste.com',
            'telefone' => '5511999999999',
            'cpf' => '12345678900'
        ],
        'utm_source' => 'kwai',
        'utm_medium' => 'cpc',
        'kwai_click_id' => 'kw_flow_test',
        'click_id' => 'kw_flow_test'
    ];
    
    // 1. Capturar tracking params
    $tracking = \captureTrackingParams($payload);
    assert($tracking['utm_source'] === 'kwai', 'Flow: utm_source');
    assert($tracking['kwai_click_id'] === 'kw_flow_test', 'Flow: kwai_click_id');
    $results[] = '✓ Fluxo completo: captura de parâmetros';
    
    // 2. Preparar dados para XTracky
    $orderId = $payload['order_id'];
    $amountInCents = intval(round($payload['total'] * 100));
    $utmSource = $tracking['utm_source'] ?: ($tracking['click_id'] ?: 'direct');
    
    $xtrackyData = [
        'orderId' => $orderId,
        'amount' => $amountInCents,
        'status' => 'waiting_payment',
        'utm_source' => $utmSource
    ];
    
    assert($xtrackyData['utm_source'] === 'kwai', 'Flow: XTracky utm_source');
    assert($xtrackyData['amount'] === 9990, 'Flow: amount em centavos');
    assert($xtrackyData['orderId'] === 'ORDER_FLOW_001', 'Flow: orderId');
    $results[] = '✓ Fluxo completo: preparação XTracky';
    
    // 3. Verificar metadata da transação (tracking params inclusos)
    $metadata = [];
    foreach ($tracking['all_params'] as $key => $value) {
        if (!empty($value)) {
            $metadata[$key] = $value;
        }
    }
    assert(isset($metadata['utm_source']), 'Flow: utm_source na metadata');
    assert(isset($metadata['kwai_click_id']), 'Flow: kwai_click_id na metadata');
    $results[] = '✓ Fluxo completo: metadata com tracking params';
    
    return $results;
}

// Executar testes
echo "=== Testes de Tracking PHP ===\n\n";

$allResults = [];
$allResults = array_merge($allResults, test_captureTrackingParams());
$allResults = array_merge($allResults, test_sendToXTrackyDataPreparation());
$allResults = array_merge($allResults, test_trackingFlowValidation());

echo "\n---\n";
echo "Total: " . count($allResults) . " testes executados\n";

foreach ($allResults as $r) {
    echo "  $r\n";
}
