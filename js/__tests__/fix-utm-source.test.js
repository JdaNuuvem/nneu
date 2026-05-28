import { describe, it, expect, beforeEach } from 'vitest';

function getUTMSource() {
  if (window.XTrackyUTM) {
    try {
      const params = window.XTrackyUTM.get();
      if (params && params.utm_source) {
        return params.utm_source;
      }
    } catch (e) { /* noop */ }
  }
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmFromUrl = urlParams.get('utm_source');
    if (utmFromUrl) {
      return utmFromUrl;
    }
    const srcFromUrl = urlParams.get('src');
    if (srcFromUrl) {
      return srcFromUrl;
    }
  } catch (e) { /* noop */ }
  try {
    const utmFromStorage = localStorage.getItem('xtracky_utm_source');
    if (utmFromStorage) {
      return utmFromStorage;
    }
    const srcFromStorage = localStorage.getItem('xtracky_src');
    if (srcFromStorage) {
      return srcFromStorage;
    }
  } catch (e) { /* noop */ }
  try {
    const cookieMatch = document.cookie.match(/utm_source=([^;]+)/);
    if (cookieMatch && cookieMatch[1]) {
      return decodeURIComponent(cookieMatch[1]);
    }
  } catch (e) { /* noop */ }
  return '';
}

function getAllUTMParams() {
  const params = {
    utm_source: '', utm_medium: '', utm_campaign: '',
    utm_content: '', utm_term: '', src: '', click_id: '',
  };
  if (window.XTrackyUTM) {
    try {
      const xTrackyParams = window.XTrackyUTM.get();
      Object.assign(params, xTrackyParams);
    } catch (e) { /* noop */ }
  }
  try {
    const urlParams = new URLSearchParams(window.location.search);
    Object.keys(params).forEach((key) => {
      if (!params[key]) {
        const value = urlParams.get(key);
        if (value) params[key] = value;
      }
    });
  } catch (e) { /* noop */ }
  try {
    Object.keys(params).forEach((key) => {
      if (!params[key]) {
        const value = localStorage.getItem('xtracky_' + key);
        if (value) params[key] = value;
      }
    });
  } catch (e) { /* noop */ }
  return params;
}

function addUTMToData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const utmSource = getUTMSource();
  data = Object.assign({}, data);
  data.utm_source = utmSource || '';
  return data;
}

function detectPlatform() {
  const utmSource = getUTMSource();
  if (!utmSource) return 'unknown';
  const source = utmSource.toLowerCase();
  if (source.startsWith('kw-') || source.includes('kwai')) return 'kwai';
  if (source.includes('fb') || source.includes('facebook')) return 'facebook';
  if (source.includes('ig') || source.includes('instagram')) return 'instagram';
  if (source.includes('tiktok') || source.includes('tt')) return 'tiktok';
  if (source.includes('google') || source.includes('gads')) return 'google';
  return 'other';
}

describe('Fix UTM Source', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.XTrackyUTM = undefined;
    // Limpar cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.replace(/=.*/, '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/');
    });
  });

  describe('getUTMSource', () => {
    it('retorna utm_source da URL quando presente', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      const source = getUTMSource();
      expect(source).toBe('kwai');
    });

    it('captura kw- prefix como utm_source', () => {
      window.location = new URL('https://example.com/?utm_source=kw-12345');
      const source = getUTMSource();
      expect(source).toBe('kw-12345');
    });

    it('usa src como fallback quando utm_source não existe', () => {
      window.location = new URL('https://example.com/?src=kw-999');
      const source = getUTMSource();
      expect(source).toBe('kw-999');
    });

    it('usa localStorage como fallback', () => {
      window.location = new URL('https://example.com');
      localStorage.setItem('xtracky_utm_source', 'kwai');
      const source = getUTMSource();
      expect(source).toBe('kwai');
    });

    it('usa localStorage src como fallback', () => {
      window.location = new URL('https://example.com');
      localStorage.setItem('xtracky_src', 'kw-555');
      const source = getUTMSource();
      expect(source).toBe('kw-555');
    });

    it('retona string vazia quando nenhuma fonte encontrada', () => {
      window.location = new URL('https://example.com');
      const source = getUTMSource();
      expect(source).toBe('');
    });

    it('usa XTrackyUTM como primeira prioridade', () => {
      window.location = new URL('https://example.com/?utm_source=url_source');
      window.XTrackyUTM = { get: () => ({ utm_source: 'xtracky_source' }) };
      const source = getUTMSource();
      expect(source).toBe('xtracky_source');
    });

    it('lida com XTrackyUTM que lança exceção', () => {
      window.location = new URL('https://example.com/?utm_source=url_fallback');
      window.XTrackyUTM = {
        get: () => { throw new Error('erro'); },
      };
      const source = getUTMSource();
      expect(source).toBe('url_fallback');
    });

    it('retorna fonte quando utm_source tem valor vazio no XTrackyUTM', () => {
      window.location = new URL('https://example.com/?utm_source=kwai_v2');
      window.XTrackyUTM = { get: () => ({ utm_source: '' }) };
      const source = getUTMSource();
      expect(source).toBe('kwai_v2');
    });

    it('usa cookie como último fallback', () => {
      window.location = new URL('https://example.com');
      Object.defineProperty(document, 'cookie', {
        value: 'utm_source=kwai_cookie',
        writable: true,
      });
      const source = getUTMSource();
      expect(source).toBe('kwai_cookie');
    });
  });

  describe('detectPlatform', () => {
    it('detecta kwai quando utm_source começa com kw-', () => {
      window.location = new URL('https://example.com/?utm_source=kw-12345');
      expect(detectPlatform()).toBe('kwai');
    });

    it('detecta kwai quando utm_source contém kwai', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      expect(detectPlatform()).toBe('kwai');
    });

    it('detecta kwai quando utm_source contém KWAI (case insensitive implícito)', () => {
      window.location = new URL('https://example.com/?utm_source=KWAI');
      expect(detectPlatform()).toBe('kwai');
    });

    it('detecta facebook', () => {
      window.location = new URL('https://example.com/?utm_source=facebook');
      expect(detectPlatform()).toBe('facebook');
    });

    it('detecta fb', () => {
      window.location = new URL('https://example.com/?utm_source=fb-ads');
      expect(detectPlatform()).toBe('facebook');
    });

    it('detecta instagram', () => {
      window.location = new URL('https://example.com/?utm_source=instagram');
      expect(detectPlatform()).toBe('instagram');
    });

    it('detecta ig', () => {
      window.location = new URL('https://example.com/?utm_source=ig-story');
      expect(detectPlatform()).toBe('instagram');
    });

    it('detecta tiktok', () => {
      window.location = new URL('https://example.com/?utm_source=tiktok');
      expect(detectPlatform()).toBe('tiktok');
    });

    it('detecta tt', () => {
      window.location = new URL('https://example.com/?utm_source=tt-ads');
      expect(detectPlatform()).toBe('tiktok');
    });

    it('detecta google', () => {
      window.location = new URL('https://example.com/?utm_source=google');
      expect(detectPlatform()).toBe('google');
    });

    it('detecta gads', () => {
      window.location = new URL('https://example.com/?utm_source=gads-search');
      expect(detectPlatform()).toBe('google');
    });

    it('retorna other para fonte desconhecida', () => {
      window.location = new URL('https://example.com/?utm_source=bing');
      expect(detectPlatform()).toBe('other');
    });

    it('retorna unknown quando não há utm_source', () => {
      window.location = new URL('https://example.com');
      expect(detectPlatform()).toBe('unknown');
    });
  });

  describe('getAllUTMParams', () => {
    it('retorna todos os parâmetros UTM da URL', () => {
      window.location = new URL(
        'https://example.com/?utm_source=kwai&utm_medium=cpc&utm_campaign=camp1&utm_content=ad1&utm_term=pneu&src=kw-123&click_id=clk_1'
      );
      const params = getAllUTMParams();
      expect(params.utm_source).toBe('kwai');
      expect(params.utm_medium).toBe('cpc');
      expect(params.utm_campaign).toBe('camp1');
      expect(params.utm_content).toBe('ad1');
      expect(params.utm_term).toBe('pneu');
      expect(params.src).toBe('kw-123');
      expect(params.click_id).toBe('clk_1');
    });

    it('usa XTrackyUTM como primeira fonte', () => {
      window.location = new URL('https://example.com');
      window.XTrackyUTM = {
        get: () => ({
          utm_source: 'kwai',
          utm_medium: 'cpc',
          utm_campaign: 'camp_xtracky',
        }),
      };
      const params = getAllUTMParams();
      expect(params.utm_source).toBe('kwai');
      expect(params.utm_campaign).toBe('camp_xtracky');
    });

    it('complementa com localStorage', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      localStorage.setItem('xtracky_utm_medium', 'cpc');
      localStorage.setItem('xtracky_click_id', 'kw_clk');
      const params = getAllUTMParams();
      expect(params.utm_source).toBe('kwai');
      expect(params.utm_medium).toBe('cpc');
      expect(params.click_id).toBe('kw_clk');
    });

    it('retorna strings vazias quando não há parâmetros', () => {
      window.location = new URL('https://example.com');
      const params = getAllUTMParams();
      expect(params.utm_source).toBe('');
      expect(params.utm_medium).toBe('');
      expect(params.utm_campaign).toBe('');
      expect(params.utm_content).toBe('');
      expect(params.utm_term).toBe('');
      expect(params.src).toBe('');
      expect(params.click_id).toBe('');
    });
  });

  describe('addUTMToData', () => {
    it('adiciona utm_source ao objeto de dados', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      const data = { order_id: 'ORD-001' };
      const result = addUTMToData(data);
      expect(result.utm_source).toBe('kwai');
      expect(result.order_id).toBe('ORD-001');
    });

    it('não modifica o objeto original', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      const data = { order_id: 'ORD-001' };
      addUTMToData(data);
      expect(data.utm_source).toBeUndefined();
    });

    it('adiciona utm_source vazio quando não encontrado', () => {
      window.location = new URL('https://example.com');
      const data = { order_id: 'ORD-001' };
      const result = addUTMToData(data);
      expect(result.utm_source).toBe('');
    });

    it('lida com data null/undefined retornando o mesmo valor', () => {
      expect(addUTMToData(null)).toBeNull();
      expect(addUTMToData(undefined)).toBeUndefined();
      expect(addUTMToData(123)).toBe(123);
    });
  });
});
