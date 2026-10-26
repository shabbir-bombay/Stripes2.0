-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('automatic', 'on', 'off');

-- CreateTable
CREATE TABLE "Service" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" "ServiceMode" NOT NULL DEFAULT 'automatic',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- Rules Prisma can't express in schema.prisma: there is exactly one row.
ALTER TABLE "Service" ADD CONSTRAINT "Service_single_row" CHECK ("id" = 1);
INSERT INTO "Service" ("id") VALUES (1);
