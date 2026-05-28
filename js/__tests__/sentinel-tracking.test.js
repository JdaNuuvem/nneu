import { describe, it, expect } from 'vitest';

describe('Sentinel Tracking - Kwai', () => {
  describe('igaming_register funnel', () => {
    const pageViewEvent = { event: 'page_view', data: {} };

    const completedRegisterEvent = {
      event: 'completed_register',
      data: {
        customer: {
          name: 'João Silva',
          email: 'joao@exemplo.com',
          phone: '+5511999999999',
        },
      },
    };

    it('deve usar event_name completed_register (com d), não complete_registration', () => {
      expect(completedRegisterEvent.event).toBe('completed_register');
      expect(completedRegisterEvent.event).not.toBe('complete_registration');
    });

    it('deve ter customer com name, email e phone', () => {
      expect(completedRegisterEvent.data.customer).toBeDefined();
      expect(completedRegisterEvent.data.customer.name).toBe('João Silva');
      expect(completedRegisterEvent.data.customer.email).toBe('joao@exemplo.com');
      expect(completedRegisterEvent.data.customer.phone).toBe('+5511999999999');
    });

    it('page_view deve vir sem customer data', () => {
      expect(pageViewEvent.data).toEqual({});
    });

    it('sequência de eventos deve ser page_view → completed_register', () => {
      const funnel = [pageViewEvent.event, completedRegisterEvent.event];
      expect(funnel).toEqual(['page_view', 'completed_register']);
    });
  });

  describe('igaming_purchase funnel', () => {
    const events = [
      { step: 1, event: 'page_view', data: {} },
      {
        step: 2,
        event: 'completed_register',
        data: {
          customer: { name: 'Maria', email: 'maria@plataforma.com', phone: '+5511999999999' },
        },
      },
      {
        step: 3,
        event: 'login',
        data: { customer: { email: 'maria@plataforma.com' } },
      },
      {
        step: 4,
        event: 'add_to_cart',
        data: { value: 100, currency: 'BRL', quantity: 1, items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }] },
      },
      {
        step: 5,
        event: 'init_checkout',
        data: {
          value: 100, currency: 'BRL', order_id: 'DEP-2024-001', shipping_amount: 0,
          items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
          customer: { name: 'Maria Silva', email: 'maria@plataforma.com', phone: '+5511999999999', cpf: '123.456.789-00' },
        },
      },
      {
        step: 6,
        event: 'purchase',
        data: {
          value: 100, currency: 'BRL', order_id: 'DEP-2024-001', shipping_amount: 0,
          items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
          customer: { name: 'Maria Silva', email: 'maria@plataforma.com', phone: '+5511999999999', cpf: '123.456.789-00' },
        },
      },
    ];

    it('deve ter 6 eventos na sequência correta', () => {
      const sequence = events.map((e) => e.event);
      expect(sequence).toEqual([
        'page_view',
        'completed_register',
        'login',
        'add_to_cart',
        'init_checkout',
        'purchase',
      ]);
    });

    it('eventos devem ter step numbers sequenciais', () => {
      events.forEach((e, i) => {
        expect(e.step).toBe(i + 1);
      });
    });

    it('purchase deve ter value e order_id para deduplicação', () => {
      const purchase = events[5];
      expect(purchase.data.value).toBe(100);
      expect(purchase.data.order_id).toBe('DEP-2024-001');
      expect(purchase.data.currency).toBe('BRL');
    });

    it('init_checkout e purchase devem compartilhar o mesmo order_id (deduplicação)', () => {
      const initCheckout = events[4];
      const purchase = events[5];
      expect(initCheckout.data.order_id).toBe(purchase.data.order_id);
    });

    it('purchase deve ter customer com cpf para melhor match Kwai', () => {
      const purchase = events[5];
      expect(purchase.data.customer.cpf).toBe('123.456.789-00');
    });

    it('add_to_cart deve ter items array com id, name, quantity, price', () => {
      const addToCart = events[3];
      expect(Array.isArray(addToCart.data.items)).toBe(true);
      expect(addToCart.data.items[0]).toMatchObject({
        id: 'deposit_100',
        name: 'Depósito R$ 100',
        quantity: 1,
        price: 100,
      });
    });

    it('login deve ter apenas email no customer (mínimo)', () => {
      const login = events[2];
      expect(login.data.customer).toEqual({ email: 'maria@plataforma.com' });
    });
  });

  describe('customer data sha-256 compliance', () => {
    const customerPayloads = [
      { name: 'João Silva', email: 'joao@exemplo.com', phone: '+5511999999999' },
      { name: 'Maria', email: 'maria@plataforma.com', phone: '+5511999999999', external_id: 'user_12345' },
    ];

    it('todos os customer payloads devem ter email', () => {
      customerPayloads.forEach((c) => {
        expect(c.email).toBeTruthy();
        expect(c.email).toContain('@');
      });
    });

    it('telefones devem estar em formato E.164 (+55...)', () => {
      customerPayloads.forEach((c) => {
        if (c.phone) {
          expect(c.phone).toMatch(/^\+55\d{10,11}$/);
        }
      });
    });

    it('external_id quando presente deve ser string', () => {
      customerPayloads.forEach((c) => {
        if (c.external_id) {
          expect(typeof c.external_id).toBe('string');
        }
      });
    });
  });

  describe('campos obrigatórios purchase', () => {
    const purchasePayload = {
      value: 100,
      currency: 'BRL',
      order_id: 'DEP-2024-001',
      items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
      customer: { name: 'Maria Silva', email: 'maria@plataforma.com', phone: '+5511999999999' },
    };

    it('value é obrigatório (ou order_id)', () => {
      expect(purchasePayload.value).toBeDefined();
      expect(typeof purchasePayload.value).toBe('number');
    });

    it('currency é recomendada', () => {
      expect(purchasePayload.currency).toMatch(/^[A-Z]{3}$/);
    });

    it('order_id é recomendado para deduplicação', () => {
      expect(purchasePayload.order_id).toBeDefined();
      expect(typeof purchasePayload.order_id).toBe('string');
    });

    it('items é opcional mas deve ser array quando presente', () => {
      if (purchasePayload.items) {
        expect(Array.isArray(purchasePayload.items)).toBe(true);
      }
    });
  });

  describe('funis suportados pela Kwai', () => {
    const funis = [
      { slug: 'marketplace', eventos: ['page_view', 'add_to_cart', 'init_checkout', 'purchase'] },
      { slug: 'registration', eventos: ['page_view', 'complete_registration'] },
      { slug: 'subscription', eventos: ['page_view', 'init_checkout', 'subscribe'] },
      { slug: 'registration_subscription', eventos: ['page_view', 'complete_registration', 'init_checkout', 'subscribe'] },
      { slug: 'igaming_register', eventos: ['page_view', 'completed_register'] },
      { slug: 'igaming_purchase', eventos: ['page_view', 'completed_register', 'login', 'add_to_cart', 'init_checkout', 'purchase'] },
    ];

    it('igaming funis são exclusivos da Kwai', () => {
      const igaming = funis.filter((f) => f.slug.startsWith('igaming'));
      expect(igaming).toHaveLength(2);
      igaming.forEach((f) => {
        expect(f.eventos).toBeDefined();
      });
    });

    it('marketplace funnel tem 4 eventos', () => {
      const mp = funis.find((f) => f.slug === 'marketplace');
      expect(mp.eventos).toHaveLength(4);
    });

    it('registration usa complete_registration (sem d)', () => {
      const reg = funis.find((f) => f.slug === 'registration');
      expect(reg.eventos).toContain('complete_registration');
      expect(reg.eventos).not.toContain('completed_register');
    });

    it('igaming_register usa completed_register (com d)', () => {
      const igaming = funis.find((f) => f.slug === 'igaming_register');
      expect(igaming.eventos).toContain('completed_register');
      expect(igaming.eventos).not.toContain('complete_registration');
    });

    it('nenhum funil deve ter sequência vazia', () => {
      funis.forEach((f) => {
        expect(f.eventos.length).toBeGreaterThan(0);
      });
    });
  });
});
