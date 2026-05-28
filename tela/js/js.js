// ================================================
// CORREÇÃO PARA EVITAR CONFLITOS COM site_config.js
// ================================================

// Salvar função original antes de ser sobreescrita
if (typeof window.adicionar_no_carrinho === 'function') {
    window.adicionar_no_carrinho_original_js1 = window.adicionar_no_carrinho;
}

// Atualizar função para evitar conflitos e redirecionar para endereco.html
window.adicionar_no_carrinho = function(self) {
    console.log('adicionar_no_carrinho chamado (versão corrigida)');
    
    // Verificar se estamos em página com site_config.js
    const currentPath = window.location.pathname;
    const isProductPage = currentPath.includes('index.html') || 
                         currentPath.includes('produto') || 
                         (window.location.search.includes('produto-id') && !currentPath.includes('tela/'));
    
    if (isProductPage && typeof SiteConfig !== 'undefined') {
        console.log('Página de produto detectada - usando site_config.js');
        
        // Adicionar produto ao carrinho usando a lógica do site_config.js
        if (typeof SiteConfig !== 'undefined' && typeof SiteConfig.addToCart === 'function') {
            SiteConfig.addToCart();
        }
        
        // Redirecionar para endereco.html após adicionar ao carrinho
        setTimeout(() => {
            window.location.href = './tela/endereco.html' + window.location.search;
        }, 500);
        
        return false;
    }
    
    // Para outras páginas, usar a função original
    if (typeof window.adicionar_no_carrinho_original_js1 === 'function') {
        const result = window.adicionar_no_carrinho_original_js1(self);
        
        // Se a função original tiver redirecionamento, não fazer nada
        // Caso contrário, redirecionar para endereco.html
        const destination = self ? self.getAttribute('data-destination') : null;
        if (!destination || destination === '#') {
            setTimeout(() => {
                window.location.href = './tela/endereco.html' + window.location.search;
            }, 500);
        }
        
        return result;
    }
    
    // Fallback: redirecionar diretamente para endereco.html
    setTimeout(() => {
        window.location.href = './tela/endereco.html' + window.location.search;
    }, 500);
    
    return false;
};

// Atualizar a função continuarCompra para redirecionar corretamente
window.continuarCompra = function() {
    const carrinho = JSON.parse(get_cookie('carrinho') || '[]');
    if (carrinho.length === 0) {
        showToast('Adicione itens ao carrinho primeiro', 'error');
        return;
    }
    fecharModalCarrinho();
    const params = window.location.search;
    
    // Verificar se já estamos na página de endereço
    const currentPath = window.location.pathname;
    if (currentPath.includes('endereco.html') || currentPath.includes('endereço')) {
        // Se já estiver na página de endereço, redirecionar para frete.html
        window.location.href = './frete.html' + params;
    } else {
        // Caso contrário, redirecionar para endereco.html
        window.location.href = './tela/endereco.html' + params;
    }
};

// Atualizar a função ir_para para suportar a nova sequência
window.ir_para = function(pagina) {
    if (pagina === 'login' && parseInt(get_cookie('pular_login')) === 1) {
        pagina = 'endereço';
    }
    
    let acionamento = '';
    if (pagina === 'login') {
        acionamento = 'Ao entrar na página login';
    } else if (pagina === 'endereço') {
        acionamento = 'Ao entrar na página endereço';
    } else if (pagina === 'frete') {
        acionamento = 'Ao entrar na página frete';
    } else if (pagina === 'pagamento') {
        acionamento = 'Ao entrar na página pagamento';
    }
    
    checkout_externo(acionamento, `/${get_cookie('caminho_atual')}/${pagina}`);
    return;
};

// Adicionar uma função específica para navegação no checkout
window.proximoPassoCheckout = function(passoAtual) {
    const params = window.location.search;
    
    switch(passoAtual) {
        case 'endereco':
            // Endereço -> Frete
            window.location.href = './frete.html' + params;
            break;
        case 'frete':
            // Frete -> Pagamento
            window.location.href = './pagamento.html' + params;
            break;
        case 'pagamento':
            // Pagamento -> Conclusão (se houver)
            // Você pode adicionar lógica para finalizar o pedido aqui
            console.log('Finalizar pedido');
            break;
        default:
            // Padrão: endereco -> frete -> pagamento
            window.location.href = './tela/endereco.html' + params;
    }
};

// Desativar completamente a função problemática do js.js se ela existir
if (typeof window.comprarAgora === 'function') {
    window.comprarAgora_original = window.comprarAgora;
    window.comprarAgora = function(fullid) {
        console.log('comprarAgora do js.js bloqueada - redirecionando para checkout');
        
        // Adicionar lógica para adicionar ao carrinho se necessário
        let quantidade = parseInt(document.getElementById('quantidadeDoProduto' + fullid)?.innerText) || 1;
        
        // Redirecionar direto para o checkout
        setTimeout(() => {
            window.location.href = './tela/endereco.html' + window.location.search;
        }, 300);
        
        return false;
    };
}

// Desativar AJAX problemático do js.js
if (typeof $ !== 'undefined') {
    $(document).off('click', '#comprar_agora');
    $(document).off('click', '#adicionar_ao_carrinho');
    
    // Adicionar novo handler para botões de checkout
    $(document).on('click', '.botao-checkout, #finalizar-compra', function(e) {
        e.preventDefault();
        const params = window.location.search;
        window.location.href = './tela/endereco.html' + params;
    });
    
    // Interceptar chamadas AJAX para /api/ que causam erros 404
    const originalAjax = $.ajax;
    $.ajax = function(settings) {
        if (settings && settings.url && settings.url.includes('/api/')) {
            console.log('Chamada AJAX para /api/ bloqueada:', settings);
            return $.Deferred().reject({ status: 404, statusText: 'Not Found' }).promise();
        }
        return originalAjax.apply(this, arguments);
    };
}