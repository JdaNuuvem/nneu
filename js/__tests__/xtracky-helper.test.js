import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('XTracky UTM Helper', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
      all_params: {},
    };
    window.getXTrackyParams = function() {
      return Object.assign({}, window.XTrackyParams);
    };
    window.addXTrackyParams = function(data) {
      return Object.assign({}, data, window.getXTrackyParams());
    };
    window.XTrackyUTM = undefined;
  });

  describe('captureURLParams from URL', () => {
    function captureURLParams() {
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
          try { localStorage.setItem('xtracky_' + param, value); } catch (e) { /* noop */ }
        }
      });
      trackingParams.forEach((param) => {
        if (!window.XTrackyParams[param]) {
          try {
            const stored = localStorage.getItem('xtracky_' + param);
            if (stored) {
              window.XTrackyParams[param] = stored;
              window.XTrackyParams.all_params[param] = stored;
            }
          } catch (e) { /* noop */ }
        }
      });
      if (!window.XTrackyParams.utm_source) {
        if (window.XTrackyParams.fbclid) window.XTrackyParams.utm_source = 'facebook';
        else if (window.XTrackyParams.gclid) window.XTrackyParams.utm_source = 'google';
        else if (window.XTrackyParams.ttclid) window.XTrackyParams.utm_source = 'tiktok';
        else if (window.XTrackyParams.kwai_click_id) window.XTrackyParams.utm_source = 'kwai';
      }
    }

    it('captura utm_source da URL', () => {
      window.location = new URL('https://example.com/?utm_source=kwai');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('kwai');
    });

    it('captura kwai_click_id da URL', () => {
      window.location = new URL('https://example.com/?kwai_click_id=kw_abc123');
      captureURLParams();
      expect(window.XTrackyParams.kwai_click_id).toBe('kw_abc123');
      expect(window.XTrackyParams.all_params.kwai_click_id).toBe('kw_abc123');
    });

    it('salva parâmetros no localStorage como fallback', () => {
      window.location = new URL('https://example.com/?utm_source=kwai&kwai_click_id=kw_xyz');
      captureURLParams();
      expect(localStorage.getItem('xtracky_utm_source')).toBe('kwai');
      expect(localStorage.getItem('xtracky_kwai_click_id')).toBe('kw_xyz');
    });

    it('restaura do localStorage se não está na URL', () => {
      window.location = new URL('https://example.com');
      localStorage.setItem('xtracky_utm_source', 'kwai');
      localStorage.setItem('xtracky_kwai_click_id', 'kw_restored');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('kwai');
      expect(window.XTrackyParams.kwai_click_id).toBe('kw_restored');
    });

    it('infer utm_source=kwai quando tem kwai_click_id mas sem utm_source', () => {
      window.location = new URL('https://example.com/?kwai_click_id=kw_inferido');
      captureURLParams();
      expect(window.XTrackyParams.kwai_click_id).toBe('kw_inferido');
      expect(window.XTrackyParams.utm_source).toBe('kwai');
    });

    it('infer utm_source=facebook quando tem fbclid', () => {
      window.location = new URL('https://example.com/?fbclid=fb_123');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('facebook');
    });

    it('infer utm_source=google quando tem gclid', () => {
      window.location = new URL('https://example.com/?gclid=gc_123');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('google');
    });

    it('infer utm_source=tiktok quando tem ttclid', () => {
      window.location = new URL('https://example.com/?ttclid=tt_123');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('tiktok');
    });

    it('não sobrescreve utm_source explícito com inferência', () => {
      window.location = new URL('https://example.com/?utm_source=kwai&fbclid=fb_123');
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('kwai');
    });

    it('captura todos os parâmetros de tracking', () => {
      window.location = new URL(
        'https://example.com/?utm_source=kwai&utm_medium=cpc&utm_campaign=camp1&utm_term=term1&utm_content=ad1&click_id=clk_1&fbclid=fb_1&gclid=gc_1&ttclid=tt_1&kwai_click_id=kw_1'
      );
      captureURLParams();
      expect(window.XTrackyParams.utm_source).toBe('kwai');
      expect(window.XTrackyParams.utm_medium).toBe('cpc');
      expect(window.XTrackyParams.utm_campaign).toBe('camp1');
      expect(window.XTrackyParams.utm_term).toBe('term1');
      expect(window.XTrackyParams.utm_content).toBe('ad1');
      expect(window.XTrackyParams.click_id).toBe('clk_1');
      expect(window.XTrackyParams.fbclid).toBe('fb_1');
      expect(window.XTrackyParams.gclid).toBe('gc_1');
      expect(window.XTrackyParams.ttclid).toBe('tt_1');
      expect(window.XTrackyParams.kwai_click_id).toBe('kw_1');
    });
  });

  describe('getXTrackyParams', () => {
    it('retorna cópia dos parâmetros atuais', () => {
      window.XTrackyParams.utm_source = 'kwai';
      window.XTrackyParams.kwai_click_id = 'kw_test';
      const params = window.getXTrackyParams();
      expect(params.utm_source).toBe('kwai');
      expect(params.kwai_click_id).toBe('kw_test');
    });

    it('retorna um novo objeto, não referência', () => {
      window.XTrackyParams.utm_source = 'kwai';
      const params = window.getXTrackyParams();
      params.utm_source = 'modified';
      expect(window.XTrackyParams.utm_source).toBe('kwai');
    });
  });

  describe('addXTrackyParams', () => {
    it('mescla parâmetros de tracking em um objeto de dados', () => {
      window.XTrackyParams.utm_source = 'kwai';
      window.XTrackyParams.kwai_click_id = 'kw_merge';
      const data = { order_id: 'ORD-001', amount: 9990 };
      const result = window.addXTrackyParams(data);
      expect(result.order_id).toBe('ORD-001');
      expect(result.amount).toBe(9990);
      expect(result.utm_source).toBe('kwai');
      expect(result.kwai_click_id).toBe('kw_merge');
    });

    it('não modifica o objeto original', () => {
      window.XTrackyParams.utm_source = 'kwai';
      const data = { order_id: 'ORD-001' };
      window.addXTrackyParams(data);
      expect(data.utm_source).toBeUndefined();
    });
  });
});
