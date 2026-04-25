-- CreateEnum
CREATE TYPE "RecognitionBasis" AS ENUM ('LAST_LAYER', 'F2L_SLOT', 'OLL_ORIENTATION', 'PLL_PERMUTATION', 'CROSS', 'OTHER');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('LEARNING', 'LEARNED', 'MASTERED');

-- CreateTable
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wcaEventCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "stateSchemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methods" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionMd" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm_sets" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "caseCountExpected" INTEGER NOT NULL,
    "recognitionBasis" "RecognitionBasis" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm_cases" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "caseState" TEXT NOT NULL,
    "recognitionMd" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm_variants" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "moveCountHtm" INTEGER NOT NULL,
    "moveCountStm" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "attribution" TEXT,
    "fingertrickMd" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "googleSub" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_algorithms" (
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chosenVariantId" TEXT,
    "status" "LearningStatus" NOT NULL DEFAULT 'LEARNING',
    "personalNotesMd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_algorithms_pkey" PRIMARY KEY ("userId","caseId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzles_slug_key" ON "puzzles"("slug");

-- CreateIndex
CREATE INDEX "methods_puzzleId_displayOrder_idx" ON "methods"("puzzleId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "methods_puzzleId_slug_key" ON "methods"("puzzleId", "slug");

-- CreateIndex
CREATE INDEX "algorithm_sets_methodId_displayOrder_idx" ON "algorithm_sets"("methodId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_sets_methodId_slug_key" ON "algorithm_sets"("methodId", "slug");

-- CreateIndex
CREATE INDEX "algorithm_cases_setId_displayOrder_idx" ON "algorithm_cases"("setId", "displayOrder");

-- CreateIndex
CREATE INDEX "algorithm_cases_tags_idx" ON "algorithm_cases" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_cases_setId_slug_key" ON "algorithm_cases"("setId", "slug");

-- CreateIndex
CREATE INDEX "algorithm_variants_caseId_displayOrder_idx" ON "algorithm_variants"("caseId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

-- CreateIndex
CREATE INDEX "user_algorithms_userId_status_idx" ON "user_algorithms"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "methods" ADD CONSTRAINT "methods_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm_sets" ADD CONSTRAINT "algorithm_sets_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm_cases" ADD CONSTRAINT "algorithm_cases_setId_fkey" FOREIGN KEY ("setId") REFERENCES "algorithm_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm_variants" ADD CONSTRAINT "algorithm_variants_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "algorithm_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_algorithms" ADD CONSTRAINT "user_algorithms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_algorithms" ADD CONSTRAINT "user_algorithms_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "algorithm_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_algorithms" ADD CONSTRAINT "user_algorithms_chosenVariantId_fkey" FOREIGN KEY ("chosenVariantId") REFERENCES "algorithm_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
