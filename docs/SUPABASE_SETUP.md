# Configuração do Supabase

O MenteHub ainda não deve receber dados reais de pacientes até concluir a configuração e os testes de autenticação, autorização e backup.

## 1. Criar o projeto

1. Acesse https://supabase.com/dashboard e crie um projeto novo.
2. Guarde a senha do banco em um gerenciador de senhas.
3. No painel do projeto, abra **SQL Editor**.
4. Copie e execute o conteúdo de [supabase/schema.sql](./supabase/schema.sql).
5. Em **Project Settings → API**, copie a Project URL e a chave pública **anon/publishable**. Nunca use a chave `service_role` no navegador.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` no ambiente de desenvolvimento e preencha:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No Cloudflare, cadastre as mesmas variáveis em **Settings → Variables and Secrets** para os ambientes de produção e preview e faça um novo deploy. Use somente a chave pública/anon no frontend; a segurança dos dados deve ser garantida pelas políticas RLS.

## 3. Autenticação

Antes de usar a agenda, pacientes ou financeiro, habilite o método de autenticação escolhido em **Authentication → Providers** e defina URLs de redirecionamento apropriadas para o domínio publicado e o ambiente local.

## 4. Verificação de segurança

O esquema habilita Row Level Security (RLS) e cria políticas que limitam cada registro ao usuário autenticado que o possui. Após executar o SQL, teste com duas contas separadas para confirmar que uma conta não consegue ler, alterar ou excluir os registros da outra.

As tabelas armazenam apenas informações administrativas. Não use o campo de observações para prontuários, diagnósticos ou notas de sessão. O esquema não substitui uma revisão de conformidade com a LGPD e as normas profissionais.

## Estado desta etapa

- [x] Esquema inicial de perfis, pacientes, consultas e lançamentos financeiros.
- [x] Políticas RLS básicas por proprietário.
- [x] Helpers cliente e servidor para Supabase.
- [ ] Projeto Supabase criado e variáveis configuradas.
- [ ] Login e recuperação de acesso implementados e testados.
- [ ] Telas de agenda, pacientes e financeiro conectadas ao banco.
- [ ] Testes de isolamento entre usuários e validação de produção.
