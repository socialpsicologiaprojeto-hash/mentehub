# MenteHub

Hub de presença digital e gestão para psicólogos. Reúne identidade visual, criação de conteúdo, agenda, organização financeira e comunicação administrativa.

> Estado atual: protótipo de interface com dados demonstrativos. Integrações externas e persistência ainda não implementadas.

## Stack

- Next.js App Router + React + TypeScript
- CSS responsivo e Lucide icons
- Supabase planejado para autenticação, PostgreSQL e armazenamento
- Integrações futuras: API de IA, WhatsApp Business Platform e provedor de pagamentos

## Requisitos

Node.js 20.9+ e npm.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Próximas etapas

1. Implementar dashboard e identidade visual persistente.
2. Criar editor e exportação de templates para redes sociais.
3. Adicionar autenticação e isolamento multi-tenant com políticas RLS.
4. Implementar agenda e controle financeiro.
5. Integrar APIs oficiais de IA, WhatsApp Business e pagamentos.

## Segurança e privacidade

Não use dados reais de pacientes no protótipo. Antes do uso real, implementar controles de acesso, consentimento, retenção, proteção de segredos, logs seguros e revisão de conformidade com a LGPD e as normas profissionais aplicáveis. Os nomes e números de exemplo na interface são ilustrativos.
