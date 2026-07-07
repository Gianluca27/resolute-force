-- CreateTable
CREATE TABLE "PageDesign" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "draft" JSONB NOT NULL,
    "published" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageDesign_pkey" PRIMARY KEY ("id")
);
