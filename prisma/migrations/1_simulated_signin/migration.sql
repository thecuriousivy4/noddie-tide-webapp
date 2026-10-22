-- AlterTable
ALTER TABLE "user_ref" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordSalt" TEXT;
