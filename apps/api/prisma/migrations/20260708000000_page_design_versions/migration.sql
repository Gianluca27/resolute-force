-- CreateTable
CREATE TABLE "PageDesignVersion" (
    "id" SERIAL NOT NULL,
    "doc" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageDesignVersion_pkey" PRIMARY KEY ("id")
);
