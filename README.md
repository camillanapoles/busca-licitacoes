# LicitaBusca - MVP

O LicitaBusca possui uma arquitetura escalável para coletar e normalizar dados de múltiplas fontes governamentais. Todas as fontes são normalizadas para um modelo único no banco de dados e integrado com avisos de WhatsApp da APIBrasil.

## Tecnologias

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- MySQL

## Como iniciar o projeto

Instale as dependências:
   ```bash
   npm i
   ```

Execute as migrations do banco de dados:
   ```bash
   npx prisma migrate dev
   ```

Popule o banco com dados iniciais (Seed):
   ```bash
   npx prisma db seed
   ```

Inicie o servidor de desenvolvimento:
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

### Prints

### Pagina inicial
<img width="1904" height="921" alt="image" src="https://github.com/user-attachments/assets/34e33e49-901e-4b87-a55c-7e36c11cd907" />

### Area do usuário
<img width="1911" height="917" alt="image" src="https://github.com/user-attachments/assets/205c7dab-d076-4b9c-9df8-78a4abe32930" />

### Dashboard
<img width="1902" height="916" alt="image" src="https://github.com/user-attachments/assets/54de82a0-5a1a-46b0-915f-aa1048912354" />

### Área do administrador
<img width="1908" height="922" alt="image" src="https://github.com/user-attachments/assets/0615ebd0-b864-45d3-b9ed-40616656043b" />

### Avisos integrados ao WhatsApp
<img width="1842" height="986" alt="image" src="https://github.com/user-attachments/assets/be4ad724-867d-45d9-a7c7-9a0ed4d74062" />


### Fontes Disponíveis

1.  **BEC-SP** (Bolsa Eletrônica de Compras de São Paulo) - *Web Service público legado*
2.  **Compras.gov.br** - *Estruturado (aguardando configuração)*
3.  **PNCP** (Portal Nacional de Contratações Públicas) - *Totalmente Operacional*
4.  **Portal de Compras Públicas** - *API pública observável, sem autenticação*
5.  **TCE-RJ** - *Dados abertos públicos*
6.  **TCE-RS / LicitaCon** - *Dados abertos em lote*
