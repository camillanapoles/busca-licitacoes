# LicitaBusca - MVP

O LicitaBusca possui uma arquitetura escalável para coletar e normalizar dados de múltiplas fontes governamentais. Todas as fontes são normalizadas para um modelo único no banco de dados e integrado com avisos de WhatsApp da APIBrasil.

## Tecnologias

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- MySQL

## Como iniciar o projeto

1. Instale as dependências:
   ```bash
   npm i
   ```

2. Execute as migrations do banco de dados:
   ```bash
   npx prisma migrate dev
   ```

3. Popule o banco com dados iniciais (Seed):
   ```bash
   npx prisma db seed
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
## Usuários de Teste

- **Admin**
  - E-mail: `admin@licitabusca.local`
  - Senha: `Admin123!`

- **Usuário Comum**
  - E-mail: `usuario@licitabusca.local`
  - Senha: `Usuario123!`

### Fontes Disponíveis

1.  **BEC-SP** (Bolsa Eletrônica de Compras de São Paulo) - *Web Service público legado*
2.  **Compras.gov.br** - *Estruturado (aguardando configuração)*
3.  **PNCP** (Portal Nacional de Contratações Públicas) - *Totalmente Operacional*
4.  **Portal de Compras Públicas** - *API pública observável, sem autenticação*
5.  **TCE-RJ** - *Dados abertos públicos*
6.  **TCE-RS / LicitaCon** - *Dados abertos em lote*