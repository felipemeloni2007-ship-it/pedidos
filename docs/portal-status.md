# Separação de acessos

- `/acesso`: seleção de área. Escolher uma área nunca atribui um cargo.
- `/plataforma`: sessão validada e presença em `platform_admins`; consulta real dos estabelecimentos. O primeiro administrador deve ser provisionado pelo operador do banco, sem cadastro público de superadmin.
- `/painel`: associações ativas em `tenant_memberships` filtradas pelo usuário autenticado; seleção de unidade e consulta de pedidos por tenant e unidade, com RLS.
- `/conta`: pedidos vinculados por `customer_auth_identities`, nunca por igualdade de telefone ou e-mail informado no checkout.
- `/admin` redireciona para `/plataforma`; `/admin/pedidos` e `/kds` levam à seleção de lojas até a operação contextualizada estar completa.

## Estado de implementação

Estas rotas substituem o painel simulado como entrada administrativa. O vendedor cria lojas, categorias, produtos, altera disponibilidade, publica o cardápio, configura bairros/taxas e avança pedidos através de comandos autorizados. `/loja/[slug]` carrega o catálogo real, mantém o carrinho no dispositivo, personaliza modificadores já cadastrados, cria pedidos como visitante e acompanha o status por token. Pedidos realizados com sessão são associados especificamente à conta autenticada. Pedidos de visitantes não são vinculados por telefone ou e-mail.

A plataforma permite listar, suspender e reativar estabelecimentos. A suspensão é verificada pelo checkout; vendedores não podem alterar o próprio status. O primeiro administrador precisa ser provisionado para um usuário confirmado indicado pelo proprietário.

Pagamento disponível: dinheiro na entrega/retirada, sempre registrado inicialmente como pendente. Pix e cartão online não estão habilitados. Os componentes antigos de demonstração permanecem no código, mas as rotas de produção não os utilizam. Estoque, financeiro completo, CRM, entregadores, fiscal e WhatsApp ainda não são operações completas. O KDS atual é a aba Cozinha no painel da unidade.

O usuário conectou o projeto `asdlqhuookyainylcdmg`, que substitui o alvo anterior. Em 21/09/2026 foram aplicadas as migrations centrais de catálogo/RBAC/checkout e a migration de acesso aos portais. O projeto possui 34 tabelas públicas, todas com RLS. O teste `supabase/tests/portal_isolation.sql` passou no banco remoto, verificando dois tenants, cliente sem acesso administrativo, rejeição de autopromoção e leitura global por administrador. Todos os dados de teste foram revertidos.

O rascunho de módulos avançados foi movido para `supabase/drafts/admin_operating_system.sql` e NÃO foi aplicado: suas políticas genéricas precisam ser restringidas por módulo. As migrations remotas receberam timestamps do Supabase MCP; é necessário reconciliar o histórico da CLI antes de automatizar migrações.

A chave pública do projeto foi configurada localmente e no ambiente Sites. `supabase/tests/live_checkout.sql` validou checkout, idempotência, token, produção, histórico e pagamento pendente. `scripts/verify-live-runtime.mjs` validou 12 etapas contra a aplicação local e o Supabase real, inclusive autenticação por senha. Os fixtures foram removidos depois dos testes. TypeScript e lint passaram (aviso de otimização de imagem). Os fluxos de e-mail exigem cadastrar a URL pública e `/auth/callback` nos redirects do Supabase Auth; não foram testados com entrega de e-mail real. Nenhuma conta de administrador real foi criada.

Antes de ativar a operação: conectar o projeto correto, revisar/aplicar migrations em ambiente de teste (incluindo as políticas amplas da migration de operações), configurar as variáveis de ambiente e URLs de retorno, provisionar o administrador inicial e testar usuários de dois tenants mais um consumidor. A seleção visual de perfil não substitui autorização.
