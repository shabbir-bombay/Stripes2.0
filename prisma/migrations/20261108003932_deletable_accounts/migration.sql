-- DropForeignKey
ALTER TABLE "PenaltyPoint" DROP CONSTRAINT "PenaltyPoint_requestedById_fkey";

-- AlterTable
ALTER TABLE "PenaltyPoint" ALTER COLUMN "requestedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
