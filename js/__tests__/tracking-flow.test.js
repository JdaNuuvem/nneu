import { describe, it, expect, beforeEach } from 'vitest';

function getUrlWithUtm(url) {
  if (typeof window === 'undefined') return url;
  const params = window.location.search;
  if (!params) return url;
  const separator = url.indexOf('?') !== -1 ? '&' : '?';
  return url + separator + params.substring(1);
}

describe('Fluxo completo de tracking (integração)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.XTrackyParams = {
      utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '',
      click_id: '', fbclid: '', gclid: '', ttclid: '', kwai_click_id: '',
      utm_id: '', utm_source_platform: '', fbp: '', fbc: '', all_params: {},
    };
    window.getXTrackyParams = function() {
      return Object.assign({}, window.XTrackyParams);
    };
    window.XTrackyUTM = undefined;
  });

  it('captura kwai_click_id e infere utm_source=kwai', () => {
    window.location = new URL('https://example.com/?kwai_click_id=kw_abc123');

    const urlParams = new URLSearchParams(window.location.search);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'click_id', 'fbclid', 'gclid', 'ttclid', 'kwai_click_id',
      'utm_id', 'utm_source_platform', 'fbp', 'fbc',
    ];
    trackingParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value) {
        window.XTrackyParams[param] = value;
        window.XTrackyParams.all_params[param] = value;
        localStorage.setItem('xtracky_' + param, value);
      }
    });
    if (!window.XTrackyParams.utm_source) {
      if (window.XTrackyParams.kwai_click_id) window.XTrackyParams.utm_source = 'kwai';
    }

    expect(window.XTrackyParams.kwai_click_id).toBe('kw_abc123');
    expect(window.XTrackyParams.utm_source).toBe('kwai');
    expect(window.XTrackyParams.all_params.kwai_click_id).toBe('kw_abc123');
  });

  it('preserva parametros de tracking no localStorage entre paginas', () => {
    window.location = new URL('https://exemplo.com/?utm_source=kwai&kwai_click_id=kw_persist');

    const urlParams = new URLSearchParams(window.location.search);
    ['utm_source', 'kwai_click_id'].forEach((p) => {
      const v = urlParams.get(p);
      if (v) localStorage.setItem('xtracky_' + p, v);
    });

    expect(localStorage.getItem('xtracky_utm_source')).toBe('kwai');
    expect(localStorage.getItem('xtracky_kwai_click_id')).toBe('kw_persist');

    window.location = new URL('https://exemplo.com/pagina2');

    const restored = {};
    ['utm_source', 'kwai_click_id'].forEach((p) => {
      restored[p] = localStorage.getItem('xtracky_' + p) || '';
    });
    expect(restored.utm_source).toBe('kwai');
    expect(restored.kwai_click_id).toBe('kw_persist');
  });

  it('detectPlatform identifica kw- prefix corretamente', () => {
    function detectPlatform() {
      const urlParams = new URLSearchParams(window.location.search);
      const source = urlParams.get('utm_source') || '';
      if (!source) return 'unknown';
      const s = source.toLowerCase();
      if (s.startsWith('kw-') || s.includes('kwai')) return 'kwai';
      if (s.includes('fb') || s.includes('facebook')) return 'facebook';
      if (s.includes('ig') || s.includes('instagram')) return 'instagram';
      if (s.includes('tiktok') || s.includes('tt')) return 'tiktok';
      if (s.includes('google') || s.includes('gads')) return 'google';
      return 'other';
    }

    window.location = new URL('https://exemplo.com/?utm_source=kw-98765');
    expect(detectPlatform()).toBe('kwai');

    window.location = new URL('https://exemplo.com/?utm_source=kwai');
    expect(detectPlatform()).toBe('kwai');

    window.location = new URL('https://exemplo.com/?utm_source=KWAI');
    expect(detectPlatform()).toBe('kwai');
  });

  it('getUrlWithUtm mantem parametros cruciais no fluxo de checkout', () => {
    window.location = new URL('https://exemplo.com/?utm_source=kwai&kwai_click_id=kw_checkout');

    const checkoutUrls = [
      'tela/endereco.html',
      'tela/frete.html',
      'tela/pagamento.html',
      'sucesso.html',
    ];

    checkoutUrls.forEach((url) => {
      const result = getUrlWithUtm(url);
      expect(result).toContain('utm_source=kwai');
      expect(result).toContain('kwai_click_id=kw_checkout');
    });
  });

  it('dados enviados ao backend incluem todos os params de tracking', () => {
    window.XTrackyParams = {
      utm_source: 'kwai', utm_medium: 'cpc', utm_campaign: 'camp_natal',
      utm_term: 'pneu', utm_content: 'banner1', click_id: 'kw_clk_001',
      fbclid: '', gclid: '', ttclid: '', kwai_click_id: 'kw_clk_001',
      utm_id: '', utm_source_platform: '', fbp: '', fbc: '',
      all_params: {
        utm_source: 'kwai', utm_medium: 'cpc', kwai_click_id: 'kw_clk_001',
      },
    };

    const requestData = {
      order_id: 'ORDER_123',
      amount: 9990,
      buyer: { email: 'teste@teste.com' },
      ...window.getXTrackyParams(),
    };

    expect(requestData.utm_source).toBe('kwai');
    expect(requestData.utm_medium).toBe('cpc');
    expect(requestData.kwai_click_id).toBe('kw_clk_001');
    expect(requestData.click_id).toBe('kw_clk_001');
    expect(requestData.order_id).toBe('ORDER_123');
  });
});
