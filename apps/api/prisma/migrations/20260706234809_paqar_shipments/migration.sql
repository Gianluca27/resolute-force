-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingApartment" TEXT,
ADD COLUMN     "shippingFloor" TEXT,
ADD COLUMN     "shippingProvince" TEXT,
ADD COLUMN     "shippingStreet" TEXT,
ADD COLUMN     "shippingStreetNumber" TEXT,
ADD COLUMN     "shippingZip" TEXT;

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "deliveryType" TEXT NOT NULL,
    "agencyId" TEXT,
    "serviceType" TEXT NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "depthCm" INTEGER NOT NULL,
    "declaredValue" INTEGER NOT NULL,
    "paqarResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "senderPhone" TEXT NOT NULL DEFAULT '',
    "senderStreet" TEXT NOT NULL,
    "senderStreetNumber" TEXT NOT NULL,
    "senderFloor" TEXT NOT NULL DEFAULT '',
    "senderApartment" TEXT NOT NULL DEFAULT '',
    "senderCity" TEXT NOT NULL,
    "senderProvince" TEXT NOT NULL,
    "senderZip" TEXT NOT NULL,
    "defaultWeightGrams" INTEGER NOT NULL DEFAULT 500,
    "defaultHeightCm" INTEGER NOT NULL DEFAULT 10,
    "defaultWidthCm" INTEGER NOT NULL DEFAULT 30,
    "defaultDepthCm" INTEGER NOT NULL DEFAULT 40,
    "defaultServiceType" TEXT NOT NULL DEFAULT 'CP',
    "labelFormat" TEXT NOT NULL DEFAULT '10x15',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingNumber_key" ON "Shipment"("trackingNumber");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
