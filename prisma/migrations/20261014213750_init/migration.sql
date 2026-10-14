-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'driver', 'admin');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('requested', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'canceled', 'no_show');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "userId" UUID NOT NULL,
    "callSign" TEXT NOT NULL,
    "cartId" UUID,
    "shiftStart" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "positionAt" TIMESTAMP(3),

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ride" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "driverId" UUID,
    "pickupId" UUID NOT NULL,
    "dropoffId" UUID NOT NULL,
    "partySize" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRule" (
    "id" UUID NOT NULL,
    "day" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "ServiceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_callSign_key" ON "DriverProfile"("callSign");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_cartId_key" ON "DriverProfile"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_number_key" ON "Cart"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Stop_name_key" ON "Stop"("name");

-- CreateIndex
CREATE INDEX "Ride_status_idx" ON "Ride"("status");

-- CreateIndex
CREATE INDEX "Ride_studentId_idx" ON "Ride"("studentId");

-- CreateIndex
CREATE INDEX "Ride_driverId_idx" ON "Ride"("driverId");

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_dropoffId_fkey" FOREIGN KEY ("dropoffId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules Prisma can't express in schema.prisma.
ALTER TABLE "User" ADD CONSTRAINT "User_pacific_email" CHECK ("email" ~* '@(u\.)?pacific\.edu$');
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_seats" CHECK ("seats" BETWEEN 2 AND 20);
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_party_size" CHECK ("partySize" > 0);
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_distinct_stops" CHECK ("pickupId" <> "dropoffId");
ALTER TABLE "ServiceRule" ADD CONSTRAINT "ServiceRule_day" CHECK ("day" BETWEEN 0 AND 6);
ALTER TABLE "ServiceRule" ADD CONSTRAINT "ServiceRule_times" CHECK ("start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- One active ride per student.
CREATE UNIQUE INDEX "Ride_one_active_per_student" ON "Ride"("studentId")
  WHERE "status" NOT IN ('completed', 'canceled', 'no_show');
