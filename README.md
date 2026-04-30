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
3.  **Portal da Transparência / CGU** - *Estruturado (aguardando configuração)*
4.  **BEC-SP** (Bolsa Eletrônica de Compras de São Paulo) - *Web Service público legado*
5.  **TCE-SP / AUDESP** - *Integração Fase IV (não é fonte de busca pública)*

### Configuração de Fontes

Para ativar as fontes adicionais, configure as variáveis de ambiente no seu arquivo `.env`:

- **PNCP**: Já configurado por padrão.
- **Compras.gov.br**: Usa `https://dadosabertos.compras.gov.br` por padrão (opcional sobrescrever `COMPRAS_GOV_BASE_URL`).
- **Transparência**: Defina `TRANSPARENCIA_BASE_URL`, `TRANSPARENCIA_API_TOKEN` e `TRANSPARENCIA_CODIGO_ORGAO` (código SIAFI do órgão).
- **BEC-SP**: Usa `https://www.bec.sp.gov.br/BEC_API/API` por padrão (opcional sobrescrever `BEC_SP_API_BASE_URL`). As consultas encerradas usam datas no formato `DDMMYYYY`.
- **TCE-SP / AUDESP**: Defina `TCE_SP_EMAIL` e `TCE_SP_PASSWORD` para autenticação, ou `TCE_SP_ACCESS_TOKEN` para consultas autenticadas. A API AUDESP não expõe `GET /licitacoes`; use PNCP e BEC-SP para buscar licitações públicas de São Paulo. Os endpoints oficiais cobertos são `/login`, `/recepcao-fase-4/f4/enviar-edital`, `/recepcao-fase-4/f4/enviar-licitacao`, `/recepcao-fase-4/f4/enviar-ata`, `/recepcao-fase-4/f4/enviar-ajuste` e `/f4/consulta/{protocolo}`.

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
