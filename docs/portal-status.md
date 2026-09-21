# Separação de acessos

- `/acesso`: seleção de área. Escolher uma área nunca atribui um cargo.
- `/plataforma`: sessão validada e presença em `platform_admins`; consulta real dos estabelecimentos. O primeiro administrador deve ser provisionado pelo operador do banco, sem cadastro público de superadmin.
- `/painel`: associações ativas em `tenant_memberships` filtradas pelo usuário autenticado; seleção de unidade e consulta de pedidos por tenant e unidade, com RLS.
- `/conta`: pedidos vinculados por `customer_auth_identities`, nunca por igualdade de telefone ou e-mail informado no checkout.
- `/admin` redireciona para `/plataforma`; `/admin/pedidos` e `/kds` levam à seleção de lojas até a operação contextualizada estar completa.

## Estado de implementação

Estas rotas substituem o painel simulado como entrada administrativa. Elas implementam autenticação e consultas reais, mas não representam a conclusão de todos os módulos pedidos. Os componentes anteriores ainda contêm ações que somente mostram mensagens, métricas fixas e catálogo de demonstração; não devem ser apresentados como funcionalidades de produção. O cardápio público continua pendente de carregamento completo por loja. A associação de pedidos de visitantes à conta requer um fluxo de verificação próprio.

O usuário conectou o projeto `asdlqhuookyainylcdmg`, que substitui o alvo anterior. Em 21/09/2026 foram aplicadas as migrations centrais de catálogo/RBAC/checkout e a migration de acesso aos portais. O projeto possui 34 tabelas públicas, todas com RLS. O teste `supabase/tests/portal_isolation.sql` passou no banco remoto, verificando dois tenants, cliente sem acesso administrativo, rejeição de autopromoção e leitura global por administrador. Todos os dados de teste foram revertidos.

A migration `20260921090000_admin_operating_system.sql` ainda NÃO foi aplicada: suas políticas genéricas de acesso precisam ser restringidas por módulo antes de qualquer uso. Não executar `db push` indiscriminadamente. As migrations remotas receberam timestamps do Supabase MCP; é necessário reconciliar o histórico da CLI antes de automatizar migrações.

A consulta de chaves públicas retornou `Insufficient scope`. O login OAuth adicional concluiu com sucesso, mas o processo MCP ativo ainda conserva a autorização anterior. A conexão do site, o login no navegador e a validação completa do checkout continuam pendentes; o site publicado ainda corresponde à demonstração anterior. Nenhuma conta de administrador real foi criada.

Antes de ativar a operação: conectar o projeto correto, revisar/aplicar migrations em ambiente de teste (incluindo as políticas amplas da migration de operações), configurar as variáveis de ambiente e URLs de retorno, provisionar o administrador inicial e testar usuários de dois tenants mais um consumidor. A seleção visual de perfil não substitui autorização.
