# LicitaBusca - MVP

Sistema de busca e monitoramento de licitações públicas no Brasil.

## Tecnologias

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Prisma ORM
- MySQL
- NextAuth.js (Auth.js)

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (para o banco de dados)

## Como iniciar o projeto

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o banco de dados MySQL usando Docker:
   ```bash
   docker-compose up -d
   ```

3. Crie o arquivo `.env` na raiz do projeto baseado no `.env.example`:
   ```bash
   cp .env.example .env
   # Certifique-se de que o DATABASE_URL aponta para o seu MySQL.
   ```

4. Execute as migrations do banco de dados:
   ```bash
   npx prisma migrate dev
   ```

5. Popule o banco com dados iniciais (Seed):
   ```bash
   npx prisma db seed
   ```

6. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

## Usuários de Teste

- **Admin**
  - E-mail: `admin@licitabusca.local`
  - Senha: `Admin123!`

- **Usuário Comum**
  - E-mail: `usuario@licitabusca.local`
  - Senha: `Usuario123!`

## Coleta de Dados e Fontes

O LicitaBusca possui uma arquitetura escalável para coletar e normalizar dados de múltiplas fontes governamentais. Todas as fontes são normalizadas para um modelo único no banco de dados.

### Fontes Disponíveis

1.  **PNCP** (Portal Nacional de Contratações Públicas) - *Totalmente Operacional*
2.  **Compras.gov.br** - *Estruturado (aguardando configuração)*
3.  **Portal de Compras Públicas** - *API pública observável, sem autenticação*
4.  **Portal da Transparência / CGU** - *Estruturado (aguardando configuração)*
5.  **BEC-SP** (Bolsa Eletrônica de Compras de São Paulo) - *Web Service público legado*
6.  **TCE-SP / AUDESP** - *Integração Fase IV (não é fonte de busca pública)*
7.  **TCE-RJ** - *Dados abertos públicos*
8.  **TCE-RS / LicitaCon** - *Dados abertos em lote*

### Configuração de Fontes

As configurações públicas das fontes são gravadas no banco pelo seed (`prisma/seed.ts`) a partir de `src/lib/sources/config.ts`. Rode `npm run db:seed` para criar ou atualizar os registros em `Fonte`.

- **PNCP, Compras.gov.br, Portal de Compras Públicas, BEC-SP, TCE-RJ e TCE-RS**: Já recebem defaults públicos pelo seed.
- **Transparência e TCE-SP / AUDESP**: ficam cadastradas com campos sensíveis vazios. Preencha token, órgão ou credenciais no cadastro/configuração da fonte quando for usar essas integrações.

## Painel Administrativo de Coletas

Acesse `/admin/coletas` para:
- Visualizar o status de configuração de cada fonte.
- Executar coletas manuais individuais ou de todas as fontes.
- Ver logs de execução, totais coletados e erros recentes.

## Arquitetura do Sistema de Coleta

- **Registry (`src/lib/sources/registry.ts`)**: Centraliza o registro de todas as fontes.
- **Collectors**: Cada fonte possui seu próprio `client`, `normalizer` e `collector` em `src/lib/sources/[fonte]`.
- **Upsert Central (`src/lib/licitacoes/upsert.ts`)**: Garante a integridade e evita duplicidade de dados usando a chave `[fonte, fonteId]`.
- **Jobs**: Orquestram a execução das coletas e gravação de logs (`ColetaLog`).

## Funcionalidades Implementadas no MVP

- **Área Pública**: Landing Page, Busca de Licitações (Filtros, Paginação), Detalhes da Licitação com identificação da fonte.
- **Área Logada**: Dashboard de resultados, Criação e gerenciamento de Avisos (Alertas).
- **Admin**: Dashboard estatístico, Painel completo de Coletas Multi-fontes.
- **Background Jobs**: Novo sistema de coleta escalável e processador de alertas cruzados (`src/lib/avisos/process.ts`).
