ALTER TABLE `User`
  ADD COLUMN `whatsappNumber` VARCHAR(191) NULL,
  ADD COLUMN `whatsappNotificationsEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `apibrasilBearerTokenEncrypted` TEXT NULL,
  ADD COLUMN `apibrasilDeviceTokenEncrypted` TEXT NULL;
