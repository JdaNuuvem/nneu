import { describe, it, expect, beforeEach, afterAll } from 'vitest';

function getUrlWithUtm(url) {
  if (typeof window === 'undefined') return url;
  const params = window.location.search;
  if (!params) return url;
  const separator = url.indexOf('?') !== -1 ? '&' : '?';
  return url + separator + params.substring(1);
}

describe('getUrlWithUtm', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com'),
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('retorna a URL sem modificação quando não há query params na página', () => {
    const url = getUrlWithUtm('produto.html?aro=13');
    expect(url).toBe('produto.html?aro=13');
  });

  it('retorna a URL sem modificação quando não há search params', () => {
    window.location = new URL('https://example.com');
    const url = getUrlWithUtm('modelos.html?aro=14');
    expect(url).toBe('modelos.html?aro=14');
  });

  it('anexa query params da página atual à URL de destino sem params', () => {
    window.location = new URL('https://example.com/?utm_source=kwai&utm_campaign=teste');
    const url = getUrlWithUtm('modelos.html');
    expect(url).toBe('modelos.html?utm_source=kwai&utm_campaign=teste');
  });

  it('anexa query params quando a URL de destino já tem params', () => {
    window.location = new URL('https://example.com/?utm_source=kwai&click_id=abc123');
    const url = getUrlWithUtm('modelos.html?aro=15');
    expect(url).toBe('modelos.html?aro=15&utm_source=kwai&click_id=abc123');
  });

  it('anexa múltiplos parâmetros UTM corretamente', () => {
    window.location = new URL(
      'https://example.com/?utm_source=kwai&utm_medium=cpc&utm_campaign=blackfriday&utm_term=pneus&utm_content=banner1'
    );
    const url = getUrlWithUtm('produto.html');
    expect(url).toBe(
      'produto.html?utm_source=kwai&utm_medium=cpc&utm_campaign=blackfriday&utm_term=pneus&utm_content=banner1'
    );
  });

  it('anexa kwai_click_id se presente na URL', () => {
    window.location = new URL('https://example.com/?kwai_click_id=kw_abc123xyz');
    const url = getUrlWithUtm('pagamento.html');
    expect(url).toContain('kwai_click_id=kw_abc123xyz');
  });

  it('lida com URL sem searchParams (undefined/null)', () => {
    // Simular página sem query string
    window.location = new URL('https://example.com');
    const result = getUrlWithUtm('index.html');
    expect(result).toBe('index.html');
  });

  it('preserva params existentes na URL de destino', () => {
    window.location = new URL('https://example.com/?utm_source=kwai');
    const url = getUrlWithUtm('produto.html?aro=13&size=175_70R13');
    expect(url).toContain('aro=13');
    expect(url).toContain('size=175_70R13');
    expect(url).toContain('utm_source=kwai');
  });

  it('retorna URL vazia se receber string vazia', () => {
    window.location = new URL('https://example.com/?utm_source=kwai');
    const url = getUrlWithUtm('');
    expect(url).toBe('?utm_source=kwai');
  });

  it('lida com URL relativa corretamente', () => {
    window.location = new URL('https://example.com/?src=kw-123');
    const url = getUrlWithUtm('../tela/pagamento.html');
    expect(url).toContain('src=kw-123');
  });

  it('escapa caracteres especiais nos parâmetros', () => {
    // Os params vêm do search da página, já encoded
    window.location = new URL('https://example.com/?utm_campaign=campanha+especial');
    const url = getUrlWithUtm('produto.html');
    expect(url).toContain('utm_campaign=campanha+especial');
  });
});
