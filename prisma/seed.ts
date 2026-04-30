import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando o seed...');

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@licitabusca.local' },
    update: {},
    create: {
      email: 'admin@licitabusca.local',
      name: 'Administrador do Sistema',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('Usuário admin criado/verificado:', adminUser.email);

  const regularPassword = await bcrypt.hash('Usuario123!', 10);
  const regularUser = await prisma.user.upsert({
    where: { email: 'usuario@licitabusca.local' },
    update: {},
    create: {
      email: 'usuario@licitabusca.local',
      name: 'Usuário Teste',
      passwordHash: regularPassword,
      role: 'USER',
    },
  });

  console.log('Usuário comum criado/verificado:', regularUser.email);

  // Fake Licitações e Avisos para testar a interface
  const aviso = await prisma.aviso.create({
    data: {
      userId: regularUser.id,
      nome: 'Licitações de Software',
      palavrasChave: 'software, sistema, desenvolvimento',
      uf: 'SP',
      frequencia: 'DIARIA',
    }
  });

  console.log('Aviso teste criado para o usuário comum');

  console.log('Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
