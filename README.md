# Pedidos

Plataforma SaaS multiempresa para venda e operação de estabelecimentos de alimentação. O produto separa duas experiências: um painel operacional para o estabelecimento e uma loja pública mobile-first para o consumidor.

> **Escopo atual:** este repositório deve priorizar a Fase 1 — catálogo, pedido e operação. Recursos como fiscal, integrações oficiais de WhatsApp/iFood, roteirização, franquias e automações avançadas ficam para fases posteriores. Não há promessa de integração de pagamento, mensageria ou emissão fiscal até que um provider seja configurado e validado.

## Fase 1

- Autenticação, perfis e isolamento por `tenant_id`; suporte a múltiplas unidades por `store_id`.
- Onboarding de estabelecimento, identidade básica da marca, horários e canais de atendimento.
- CRUD de categorias, produtos, fotos, variantes e grupos de modificadores.
- Loja pública responsiva com pesquisa, produto configurável, carrinho persistente e checkout como visitante.
- Entrega, retirada e consumo local; regras iniciais de área/taxa de entrega.
- Criação e acompanhamento de pedidos, central operacional e KDS com atualização em tempo real.
- Fluxo de pagamento preparado por adapter. Em demonstração, o status pode ser simulado; um Pix real exige gateway, webhook assinado e validação no servidor.
- Dados de demonstração da loja **Forno 27** para explorar o fluxo sem depender de dados reais.

## Central administrativa expandida

O painel `/admin` reúne a operação diária e os módulos de crescimento em uma única central responsiva:

- visão executiva com pico de demanda, capacidade, alertas de estoque, pagamentos pendentes e produtos em alta;
- central de pedidos/PDV com busca, filtros, troca de status, impressão e atalhos para cozinha;
- catálogo com edição de disponibilidade, CMV, categorias, adicionais e edição em massa;
- CRM com segmentos (VIP, recorrente, novo, em risco e inativo), gasto total, recompra e consentimento;
- despacho com entregadores, SLA, zonas, taxas, pedido mínimo e agrupamento de rotas;
- estoque com ficha técnica, fornecedores, compras, custo médio, alertas e baixa automática por venda entregue;
- financeiro com caixa, sangria, fechamento, recebimentos por método, despesas e conciliação;
- marketing com cupons, combos, happy hour, cashback, pontos, funil e recuperação de carrinho;
- equipe com RBAC, permissões por função, convite e auditoria; configurações de canais, pagamentos, impressão e integrações.

Na loja do consumidor, o carrinho continua persistente e o fluxo foi ampliado com favoritos locais, clube de pontos/cashback, recompra em um toque, endereço antecipado, upsell e acompanhamento do pedido.

## Arquitetura

```text
Cliente público / Painel operacional
              │
     Next.js + TypeScript + Tailwind
              │
  rotas de servidor / validação Zod / RBAC
              │
 Supabase: Postgres + Auth + Realtime + Storage
              │
  migrations SQL, RLS, índices e audit logs
```

O banco é relacional. Registros que pertencem ao negócio devem levar `tenant_id`; dados operacionais de uma unidade também levam `store_id`. O frontend nunca é a barreira de isolamento: toda consulta e mutação deve ser autorizada no backend e pelas políticas de Row Level Security (RLS).

Entidades centrais da primeira fase incluem:

```text
tenants, stores, profiles, roles, permissions, user_roles
categories, products, product_images, product_variants
modifier_groups, modifier_options, product_modifier_groups
customers, customer_addresses, delivery_zones
orders, order_items, order_item_modifiers, order_status_history
payments, notifications, audit_logs
```

O modelo deixa espaço para estoque, fichas técnicas, mesas, PDV, entregadores, CRM, fidelidade, financeiro e integrações sem quebrar o isolamento de tenants.

## Pré-requisitos

- Node.js 22 ou superior
- pnpm 11.25.0 (via Corepack ou instalação local)
- Um projeto Supabase
- Supabase CLI para migrations e geração de tipos

## Variáveis de ambiente

Crie `.env.local` a partir deste exemplo. O endereço informado para o projeto é a base do projeto, **sem** `/rest/v1/`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://cnqpecamfgtqtwxzzsnm.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cole_a_chave_publishable

# Apenas código executado no servidor. Nunca exponha ao navegador.
SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=true
```

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente público, protegido pelas políticas RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Tarefas administrativas/webhooks no servidor; ignora RLS e requer proteção máxima. |
| `NEXT_PUBLIC_APP_URL` | URL canônica usada por links e redirecionamentos permitidos. |
| `NEXT_PUBLIC_DEMO_MODE` | Habilita apenas dados e transições simuladas para apresentação. Nunca usar para contornar autorização. |

Não versionar `.env.local`, tokens, chaves de gateway ou URLs assinadas. Rotacione uma chave caso ela seja exposta.

## Desenvolvimento local

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Abra a URL exibida pelo comando. Antes de desenvolver uma funcionalidade protegida, aplique as migrations e configure as variáveis acima.

## Supabase: migrations e tipos

Use migrations versionadas no repositório, por exemplo em `supabase/migrations/`. Não altere a estrutura de produção manualmente pelo Dashboard sem registrar a mesma mudança em SQL. A migration `20260921090000_admin_operating_system.sql` adiciona o back office de estoque, ficha técnica, fornecedores, compras, mesas, comandas, entregas, cupons, promoções, fidelidade, avaliações, caixa, despesas, notificações e integrações.

```bash
# Autentique e vincule o projeto uma vez por máquina
npx supabase login
npx supabase link --project-ref cnqpecamfgtqtwxzzsnm

# Aplica migrations pendentes ao projeto vinculado
npx supabase db push

# Gera tipos TypeScript a partir do schema remoto
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

Para desenvolvimento inteiramente local, use `npx supabase start`, aplique as migrations com `npx supabase db reset` e aponte o `.env.local` para as credenciais que a CLI mostrar. `db reset` recria o banco local e **não** deve ser usado contra produção.

Depois de adicionar ou modificar uma migration:

1. Rode-a em um projeto/local de desenvolvimento.
2. Verifique RLS, chaves estrangeiras, índices e dados de seed.
3. Regere os tipos TypeScript.
4. Execute lint, testes e build antes do deploy.

## Segurança e RLS

- Ative RLS em toda tabela exposta pela API do Supabase.
- Derive o tenant e as permissões da associação autenticada do usuário; não aceite `tenant_id`, `role` ou preço final enviados pelo navegador como fonte de verdade.
- Em políticas RLS, restrinja leitura e escrita à associação usuário–tenant e, quando necessário, à unidade autorizada.
- Use funções `security definer` somente quando indispensável, com `search_path` explícito e checagens de tenant; prefira policies simples e auditáveis.
- Revalide no servidor disponibilidade, modificadores, subtotal, desconto, taxa de entrega, total, estoque e transição de status do pedido.
- Use idempotência e assinatura na entrada de webhooks. Um webhook de pagamento não deve confiar em status enviado pelo cliente.
- Registre mudanças sensíveis (preço, permissões, cancelamentos e alterações de pedido) em `audit_logs`.
- A `service_role` só pode existir em ambiente de servidor confiável. Ela não entra em bundles, componentes de cliente ou logs.

## Modo demonstração

Com `NEXT_PUBLIC_DEMO_MODE=true`, a aplicação pode mostrar a loja **Forno 27**, catálogo e pedidos fictícios. Esse modo deve:

- usar apenas registros de seed ou mocks claramente identificados;
- impedir ações irreversíveis e chamadas a gateways reais;
- permitir demonstrar o caminho loja → checkout → pedido → KDS;
- manter as mesmas regras de validação visual e de autorização da aplicação normal.

Desative-o em produção com `NEXT_PUBLIC_DEMO_MODE=false`. O modo demo não substitui migrations, RLS nem uma integração de pagamentos real.

## Papéis e permissões

O RBAC deve começar com papéis como proprietário, gerente, caixa, atendente e cozinha. Papéis adicionais — garçom, entregador, marketing e financeiro — podem ser liberados quando os módulos correspondentes existirem. A permissão é aplicada no servidor e no banco; esconder um botão não é autorização.

## Pagamentos e integrações

O domínio de pagamentos guarda estados internos (`pending`, `authorized`, `paid`, `failed`, `refunded`, `canceled`) e identificadores do provider. A confirmação confiável ocorre por webhook verificado pelo servidor. Até haver um provider configurado, a interface deve tratar pagamento como demonstração/simulação e não como cobrança real.

Arquiteturas de adapter podem ser adicionadas posteriormente para gateways, WhatsApp, mapas, fiscal, impressão e analytics. Cada integração precisa de credenciais próprias, contrato de webhook, rate limiting, observabilidade e testes antes de ser anunciada como suportada.

## Qualidade

```bash
pnpm run lint
pnpm run build
```

Inclua testes para regras de preço/modificadores, isolamento de tenant, cálculo de entrega e transições de pedido. Valide também a jornada mobile em largura aproximada de 360–430 px e os estados de carregamento, erro, loja fechada, área não atendida e pagamento não confirmado.

## GitHub

Para publicar o código no repositório informado:

```bash
git init
git add .
git commit -m "feat: iniciar plataforma de pedidos"
git branch -M main
git remote add origin https://github.com/felipemeloni2007-ship-it/pedidos.git
git push -u origin main
```

Se o remoto já existir, confirme-o antes de enviar com `git remote -v`. Nunca force-push em uma branch compartilhada sem autorização. Revise `git status` para garantir que `.env*`, artefatos locais e credenciais não serão enviados.

## Deploy

1. Crie um ambiente Supabase separado para produção e aplique migrations revisadas.
2. Cadastre no host as mesmas variáveis de ambiente, com chaves de produção; mantenha `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor.
3. Configure URLs de redirect e domínios permitidos no Supabase Auth.
4. Execute `npm run lint` e `npm run build` no pipeline.
5. Faça deploy do app Next.js no host escolhido e configure a URL pública em `NEXT_PUBLIC_APP_URL`.
6. Só depois habilite webhooks e pagamentos reais; valide assinatura, idempotência e logs em ambiente de teste primeiro.

O pipeline deve aplicar migrations de maneira controlada, com backup e revisão, e não a partir do navegador ou de uma chave pública.

## Próximas fases

- PDV, mesas, QR Code, entregadores e estoque/ficha técnica.
- Cupons, promoções, CRM, fidelidade e relatórios avançados.
- Integrações fiscais, mensageria, marketplaces, multiunidade avançada e franquias.

Essas extensões devem preservar os limites de tenant e store definidos desde o início.

