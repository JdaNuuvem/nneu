/**
 * XTracky UTM Helper
 * Captura todos os parâmetros de tracking da URL e disponibiliza para envio nas requisições
 */

(function(window) {
    'use strict';

    window.XTrackyParams = {
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_term: '',
        utm_content: '',
        click_id: '',
        fbclid: '',
        gclid: '',
        ttclid: '',
        kwai_click_id: '',
        utm_id: '',
        utm_source_platform: '',
        fbp: '',
        fbc: '',
        all_params: {}
    };

    function captureURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'click_id', 'fbclid', 'gclid', 'ttclid', 'kwai_click_id',
            'utm_id', 'utm_source_platform', 'fbp', 'fbc'
        ];
        trackingParams.forEach(param => {
            const value = urlParams.get(param);
            if (value) {
                window.XTrackyParams[param] = value;
                window.XTrackyParams.all_params[param] = value;
                try { localStorage.setItem('xtracky_' + param, value); } catch (e) {}
            }
        });
        trackingParams.forEach(param => {
            if (!window.XTrackyParams[param]) {
                try {
                    const stored = localStorage.getItem('xtracky_' + param);
                    if (stored) {
                        window.XTrackyParams[param] = stored;
                        window.XTrackyParams.all_params[param] = stored;
                    }
                } catch (e) {}
            }
        });
        if (!window.XTrackyParams.utm_source) {
            if (window.XTrackyParams.fbclid) window.XTrackyParams.utm_source = 'facebook';
            else if (window.XTrackyParams.gclid) window.XTrackyParams.utm_source = 'google';
            else if (window.XTrackyParams.ttclid) window.XTrackyParams.utm_source = 'tiktok';
            else if (window.XTrackyParams.kwai_click_id) window.XTrackyParams.utm_source = 'kwai';
        }
    }

    window.getXTrackyParams = function() {
        return Object.assign({}, window.XTrackyParams);
    };
    window.addXTrackyParams = function(data) {
        return Object.assign({}, data, window.getXTrackyParams());
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', captureURLParams);
    } else {
        captureURLParams();
    }
})(window);
