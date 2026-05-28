(function() {
    'use strict';
    
    /**
     * Captura o utm_source de múltiplas fontes (ordem de prioridade)
     * @returns {string} utm_source capturado ou string vazia
     */
    window.getUTMSource = function() {
        console.log('🔍 Tentando capturar utm_source...');
        
        // 1. Primeira prioridade: XTracky Helper (mais confiável)
        if (window.XTrackyUTM) {
            try {
                const params = window.XTrackyUTM.get();
                if (params && params.utm_source) {
                    console.log('✅ utm_source do XTrackyUTM:', params.utm_source);
                    return params.utm_source;
                }
            } catch (e) {
                console.warn('⚠️ Erro ao ler XTrackyUTM:', e);
            }
        }
        
        // 2. Segunda prioridade: URL atual
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const utmFromUrl = urlParams.get('utm_source');
            if (utmFromUrl) {
                console.log('✅ utm_source da URL:', utmFromUrl);
                return utmFromUrl;
            }
            
            // Também tentar 'src' (alternativa usada por alguns trackers)
            const srcFromUrl = urlParams.get('src');
            if (srcFromUrl) {
                console.log('✅ utm_source do parâmetro src:', srcFromUrl);
                return srcFromUrl;
            }
        } catch (e) {
            console.warn('⚠️ Erro ao ler URL params:', e);
        }
        
        // 3. Terceira prioridade: localStorage (salvo pelo helper)
        try {
            const utmFromStorage = localStorage.getItem('xtracky_utm_source');
            if (utmFromStorage) {
                console.log('✅ utm_source do localStorage:', utmFromStorage);
                return utmFromStorage;
            }
            
            // Também tentar 'src'
            const srcFromStorage = localStorage.getItem('xtracky_src');
            if (srcFromStorage) {
                console.log('✅ utm_source do localStorage (src):', srcFromStorage);
                return srcFromStorage;
            }
        } catch (e) {
            console.warn('⚠️ Erro ao ler localStorage:', e);
        }
        
        // 4. Quarta prioridade: Cookie
        try {
            const cookieMatch = document.cookie.match(/utm_source=([^;]+)/);
            if (cookieMatch && cookieMatch[1]) {
                const utmFromCookie = decodeURIComponent(cookieMatch[1]);
                console.log('✅ utm_source do cookie:', utmFromCookie);
                return utmFromCookie;
            }
        } catch (e) {
            console.warn('⚠️ Erro ao ler cookie:', e);
        }
        
        // Se chegou aqui, não encontrou utm_source em lugar nenhum
        console.warn('❌ utm_source NÃO foi encontrado em nenhuma fonte!');
        console.warn('💡 Certifique-se que a URL contém ?utm_source=VALOR');
        
        return '';
    };
    
    /**
     * Captura TODOS os parâmetros UTM
     * @returns {object} Objeto com todos os parâmetros UTM
     */
    window.getAllUTMParams = function() {
        const params = {
            utm_source: '',
            utm_medium: '',
            utm_campaign: '',
            utm_content: '',
            utm_term: '',
            src: '',
            click_id: ''
        };
        
        // Tentar do XTracky Helper primeiro
        if (window.XTrackyUTM) {
            try {
                const xTrackyParams = window.XTrackyUTM.get();
                Object.assign(params, xTrackyParams);
            } catch (e) {
                console.warn('Erro ao ler XTrackyUTM:', e);
            }
        }
        
        // Complementar com URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            Object.keys(params).forEach(key => {
                if (!params[key]) {
                    const value = urlParams.get(key);
                    if (value) params[key] = value;
                }
            });
        } catch (e) {
            console.warn('Erro ao ler URL params:', e);
        }
        
        // Complementar com localStorage
        try {
            Object.keys(params).forEach(key => {
                if (!params[key]) {
                    const value = localStorage.getItem('xtracky_' + key);
                    if (value) params[key] = value;
                }
            });
        } catch (e) {
            console.warn('Erro ao ler localStorage:', e);
        }
        
        return params;
    };
    
    /**
     * Adiciona utm_source automaticamente a um objeto de dados
     * @param {object} data - Objeto para adicionar utm_source
     * @returns {object} Objeto com utm_source adicionado
     */
    window.addUTMToData = function(data) {
        if (!data || typeof data !== 'object') {
            console.error('❌ addUTMToData: data deve ser um objeto');
            return data;
        }
        
        const utmSource = getUTMSource();
        
        if (utmSource) {
            data.utm_source = utmSource;
            console.log('✅ utm_source adicionado ao objeto:', utmSource);
        } else {
            console.warn('⚠️ utm_source vazio - não foi adicionado ao objeto');
            data.utm_source = '';
        }
        
        return data;
    };
    
    /**
     * Detecta a plataforma baseado no utm_source
     * @returns {string} Nome da plataforma detectada
     */
    window.detectPlatform = function() {
        const utmSource = getUTMSource();
        
        if (!utmSource) return 'unknown';
        
        const source = utmSource.toLowerCase();
        
        // Kwai
        if (source.startsWith('kw-') || source.includes('kwai')) {
            return 'kwai';
        }
        
        // Facebook
        if (source.includes('fb') || source.includes('facebook')) {
            return 'facebook';
        }
        
        // Instagram
        if (source.includes('ig') || source.includes('instagram')) {
            return 'instagram';
        }
        
        // TikTok
        if (source.includes('tiktok') || source.includes('tt')) {
            return 'tiktok';
        }
        
        // Google
        if (source.includes('google') || source.includes('gads')) {
            return 'google';
        }
        
        return 'other';
    };
    
    // Log de inicialização
    console.log('🔧 Fix UTM Source carregado!');
    
    // Fazer um teste automático ao carregar
    const testUtm = getUTMSource();
    if (testUtm) {
        console.log('✅ utm_source detectado automaticamente:', testUtm);
        console.log('📊 Plataforma detectada:', detectPlatform());
    } else {
        console.warn('⚠️ utm_source não detectado na URL atual');
    }
    
})();