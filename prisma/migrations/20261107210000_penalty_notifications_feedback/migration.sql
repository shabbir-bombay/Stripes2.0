-- CreateEnum
CREATE TYPE "PenaltyPointStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ride_assigned', 'driver_arrived', 'ride_canceled', 'penalty_point');

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "cartNumber" TEXT;

-- CreateTable
CREATE TABLE "PenaltyPoint" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "rideId" UUID,
    "reason" TEXT NOT NULL,
    "status" "PenaltyPointStatus" NOT NULL DEFAULT 'pending',
    "requestedById" UUID NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "text" TEXT NOT NULL,
    "rideId" UUID,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "rideId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("rideId")
);

-- CreateIndex
CREATE INDEX "PenaltyPoint_studentId_status_idx" ON "PenaltyPoint"("studentId", "status");

-- CreateIndex
CREATE INDEX "PenaltyPoint_status_createdAt_idx" ON "PenaltyPoint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rides a driver holds right now keep the cart that driver is on.
UPDATE "Ride" SET "cartNumber" = "Cart"."number"
  FROM "DriverProfile" JOIN "Cart" ON "DriverProfile"."cartId" = "Cart"."id"
  WHERE "Ride"."driverId" = "DriverProfile"."userId"
    AND "Ride"."status" IN ('assigned', 'en_route', 'arrived', 'in_progress');

-- Rules Prisma can't express in schema.prisma.
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rating" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "PenaltyPoint" ADD CONSTRAINT "PenaltyPoint_decided" CHECK (("status" = 'pending') = ("decidedAt" IS NULL));

-- One live penalty point per ride. A rejected one may be asked for again.
CREATE UNIQUE INDEX "PenaltyPoint_one_per_ride" ON "PenaltyPoint"("rideId")
  WHERE "rideId" IS NOT NULL AND "status" <> 'rejected';
