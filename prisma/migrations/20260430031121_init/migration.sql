-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Licitacao` (
    `id` VARCHAR(191) NOT NULL,
    `fonte` VARCHAR(191) NOT NULL,
    `fonteId` VARCHAR(191) NOT NULL,
    `orgao` VARCHAR(191) NOT NULL,
    `cnpjOrgao` VARCHAR(191) NULL,
    `uf` VARCHAR(191) NULL,
    `municipio` VARCHAR(191) NULL,
    `modalidade` VARCHAR(191) NULL,
    `numeroCompra` VARCHAR(191) NULL,
    `anoCompra` INTEGER NULL,
    `sequencialCompra` VARCHAR(191) NULL,
    `objeto` TEXT NOT NULL,
    `valorEstimado` DOUBLE NULL,
    `dataPublicacao` DATETIME(3) NULL,
    `dataFimProposta` DATETIME(3) NULL,
    `status` VARCHAR(191) NULL,
    `link` TEXT NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Licitacao_uf_idx`(`uf`),
    INDEX `Licitacao_municipio_idx`(`municipio`),
    INDEX `Licitacao_modalidade_idx`(`modalidade`),
    INDEX `Licitacao_status_idx`(`status`),
    INDEX `Licitacao_dataPublicacao_idx`(`dataPublicacao`),
    INDEX `Licitacao_dataFimProposta_idx`(`dataFimProposta`),
    INDEX `Licitacao_valorEstimado_idx`(`valorEstimado`),
    UNIQUE INDEX `Licitacao_fonte_fonteId_key`(`fonte`, `fonteId`),
    FULLTEXT INDEX `Licitacao_objeto_idx`(`objeto`),
    FULLTEXT INDEX `Licitacao_orgao_idx`(`orgao`),
    FULLTEXT INDEX `fulltext_municipio`(`municipio`),
    FULLTEXT INDEX `fulltext_modalidade`(`modalidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LicitacaoItem` (
    `id` VARCHAR(191) NOT NULL,
    `licitacaoId` VARCHAR(191) NOT NULL,
    `numeroItem` INTEGER NULL,
    `descricao` TEXT NOT NULL,
    `quantidade` DOUBLE NULL,
    `unidade` VARCHAR(191) NULL,
    `valorUnitario` DOUBLE NULL,
    `valorTotal` DOUBLE NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Aviso` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `palavrasChave` TEXT NOT NULL,
    `uf` VARCHAR(191) NULL,
    `municipio` VARCHAR(191) NULL,
    `modalidade` VARCHAR(191) NULL,
    `valorMinimo` DOUBLE NULL,
    `valorMaximo` DOUBLE NULL,
    `frequencia` ENUM('DIARIA', 'SEMANAL', 'MANUAL') NOT NULL DEFAULT 'DIARIA',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AvisoResultado` (
    `id` VARCHAR(191) NOT NULL,
    `avisoId` VARCHAR(191) NOT NULL,
    `licitacaoId` VARCHAR(191) NOT NULL,
    `visualizado` BOOLEAN NOT NULL DEFAULT false,
    `enviado` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AvisoResultado_avisoId_licitacaoId_key`(`avisoId`, `licitacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ColetaLog` (
    `id` VARCHAR(191) NOT NULL,
    `fonte` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NULL,
    `totalColetado` INTEGER NOT NULL DEFAULT 0,
    `totalNovo` INTEGER NOT NULL DEFAULT 0,
    `totalAtualizado` INTEGER NOT NULL DEFAULT 0,
    `erro` TEXT NULL,
    `metadata` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fonte` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `baseUrl` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Fonte_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `query` VARCHAR(191) NOT NULL,
    `filtros` JSON NULL,
    `totalResultados` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LicitacaoItem` ADD CONSTRAINT `LicitacaoItem_licitacaoId_fkey` FOREIGN KEY (`licitacaoId`) REFERENCES `Licitacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Aviso` ADD CONSTRAINT `Aviso_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AvisoResultado` ADD CONSTRAINT `AvisoResultado_avisoId_fkey` FOREIGN KEY (`avisoId`) REFERENCES `Aviso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AvisoResultado` ADD CONSTRAINT `AvisoResultado_licitacaoId_fkey` FOREIGN KEY (`licitacaoId`) REFERENCES `Licitacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchLog` ADD CONSTRAINT `SearchLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
