# Kwai — Sentinel Tracking

Integração do Sentinel Tracking com a **Kwai** para envio de conversões server-side e atribuição de campanhas.

---

## Funis suportados

| Funil | Slug | Eventos despachados |
|-------|------|---------------------|
| Marketplace | `marketplace` | `page_view` → `add_to_cart` → `init_checkout` → `purchase` |
| Cadastro | `registration` | `page_view` → `complete_registration` |
| Assinatura | `subscription` | `page_view` → `init_checkout` → `subscribe` |
| Cadastro + assinatura | `registration_subscription` | `page_view` → `complete_registration` → `init_checkout` → `subscribe` |
| iGaming — Cadastro | `igaming_register` | `page_view` → `completed_register` |
| iGaming — Compra | `igaming_purchase` | `page_view` → `completed_register` → `login` → `add_to_cart` → `init_checkout` → `purchase` |

> Os funis `igaming_register` e `igaming_purchase` são **exclusivos da rede Kwai** — não é possível associá-los a outra rede no Sentinel.

---

## Funis iGaming (Kwai-only)

### igaming_register — Cadastro

Use este funil para produtos de iGaming onde o objetivo principal é o **cadastro do usuário** na plataforma.

**Passo a passo:**
1. `page_view` — ao abrir a landing page ou página do produto.
2. `completed_register` — após o formulário de cadastro ser enviado com sucesso.

```js
// 1. Ao carregar a página
Sentinel.track('page_view', {});

// 2. Cadastro concluído
Sentinel.track('completed_register', {
  customer: {
    name: 'João',
    email: 'joao@exemplo.com',
    phone: '+5511999999999',
  },
});
```

> **Importante:** use `completed_register` (com **d**), não `complete_registration`.

**Webhook de gateway:** se um gateway enviar um evento `purchase`, o Sentinel o renomeia para `completed_register` automaticamente. Webhooks de `init_checkout` são ignorados.

---

### igaming_purchase — Compra / Depósito

Use este funil para o fluxo completo: desde a visita até o primeiro depósito ou compra na plataforma iGaming.

> Passos 5 e 6 podem ser recebidos via webhook do gateway (sem SDK), se a confirmação do depósito vier do backend.

| Passo | `event_name` | Quando disparar |
|-------|-------------|-----------------|
| 1 | `page_view` | Ao abrir a landing page / home da plataforma. |
| 2 | `completed_register` | Após o cadastro ser concluído. |
| 3 | `login` | Após o usuário fazer login na plataforma. |
| 4 | `add_to_cart` | Quando o usuário seleciona o valor do depósito / inicia o processo. |
| 5 | `init_checkout` | Ao abrir a tela de pagamento do depósito. |
| 6 | `purchase` | Quando o depósito é confirmado / compra concluída. |

```js
// 1. Landing page
Sentinel.track('page_view', {});

// 2. Cadastro concluído
Sentinel.track('completed_register', {
  customer: {
    name: 'Maria',
    email: 'maria@plataforma.com',
    phone: '+5511999999999',
  },
});

// 3. Login na plataforma
Sentinel.track('login', {
  customer: { email: 'maria@plataforma.com' },
});

// 4. Usuário selecionou valor de depósito
Sentinel.track('add_to_cart', {
  value: 100,
  currency: 'BRL',
  quantity: 1,
  items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
});

// 5. Checkout do depósito aberto
Sentinel.track('init_checkout', {
  value: 100,
  currency: 'BRL',
  order_id: 'DEP-2024-001',
  shiping_amount: 0,
  items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
  customer: {
    name: 'Maria Silva',
    email: 'maria@plataforma.com',
    phone: '+5511999999999',
    cpf: '123.456.789-00',
  },
});

// 6. Depósito confirmado / compra concluída
Sentinel.track('purchase', {
  value: 100,
  currency: 'BRL',
  order_id: 'DEP-2024-001',
  shiping_amount: 0,
  items: [{ id: 'deposit_100', name: 'Depósito R$ 100', quantity: 1, price: 100 }],
  customer: {
    name: 'Maria Silva',
    email: 'maria@plataforma.com',
    phone: '+5511999999999',
    cpf: '123.456.789-00',
  },
});
```

**Webhook de gateway:** o evento `purchase` enviado pelo gateway é processado como `purchase` (sem renomeação — igual ao fluxo marketplace). Configure o webhook normalmente no produto.

---

## Campos obrigatórios e recomendados

### Eventos de compra / depósito (`purchase`)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `value` | `number` | Sim (ou `order_id`) | Valor do depósito/compra. |
| `currency` | `string` | Recomendado | Ex.: `BRL`, `USD`. |
| `order_id` | `string` | Recomendado | ID único do pedido/depósito — usado na deduplicação. |
| `items` | `array` | Opcional | Lista de itens; melhora dados do relatório Kwai. |

### Dados do usuário (`customer`)

Enviados em qualquer evento. O Sentinel aplica **SHA-256** antes de enviar à Kwai:

| Campo | Exemplo |
|-------|---------|
| `email` | `"joao@exemplo.com"` |
| `phone` | `"+5511999999999"` (formato E.164) |
| `name` | `"João Silva"` |
| `external_id` | ID interno do usuário na plataforma |

```js
Sentinel.track('completed_register', {
  customer: {
    email: 'joao@exemplo.com',
    phone: '+5511999999999',
    name: 'João Silva',
    external_id: 'user_12345',
  },
});
```

---

## Configuração no painel

1. No **Sentinel Tracking**, acesse **Produtos** → **Criar produto** (ou editar existente).
2. Em **Tipo de funil**, selecione **iGaming — Cadastro** (`igaming_register`) ou **iGaming — Compra** (`igaming_purchase`).
3. Em **Rede**, selecione **Kwai** (única rede disponível para estes funis).
4. Configure as credenciais do pixel Kwai (Access Token, Pixel ID).
5. Salve e use o **modal de teste** (ícone de tubo de ensaio no produto) para enviar eventos de teste e validar a integração.

---

## Outros funis com Kwai

Além dos funis iGaming, a Kwai também suporta os funis `marketplace`, `registration`, `subscription` e `registration_subscription`. Para esses funis, a Kwai **não é a única rede suportada** — você pode combinar com Meta, TikTok e outros pixels no mesmo produto.

Para detalhes de payload desses funis, consulte [Dados dos eventos](https://docs.sentineltracking.io/docs/configuracao/dados-dos-eventos) e [Tipos de funil](https://docs.sentineltracking.io/docs/configuracao/tipos-de-funil).
