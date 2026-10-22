-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlaceStatus" AS ENUM ('WORKS_PROPOSED', 'UNDER_WATCH', 'QUIET');

-- CreateEnum
CREATE TYPE "ChangeState" AS ENUM ('DRAFT', 'NOTICE_ISSUED', 'PENDING_QUORUM', 'APPROVED', 'REJECTED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('WORKS_PERMIT', 'RESTRICTED_READ', 'PERMIT_REVOCATION');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVE', 'DENY');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('WORKS_NOTICE', 'MINISTERIAL_ANNOUNCEMENT', 'PERMIT_INSTRUMENT', 'REFUSAL_NOTICE');

-- CreateTable
CREATE TABLE "custodian_org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "consentRule" TEXT NOT NULL,
    "quorumThreshold" INTEGER NOT NULL DEFAULT 2,
    "custodianCount" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "custodian_org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "publicSummary" TEXT NOT NULL,
    "scene" TEXT NOT NULL DEFAULT 'ridge',
    "zoneCells" TEXT[],
    "status" "PlaceStatus" NOT NULL DEFAULT 'QUIET',
    "custodianOrgId" TEXT NOT NULL,
    "sealedName" TEXT NOT NULL,
    "sealedBoundary" TEXT NOT NULL,
    "sealedSignificance" TEXT NOT NULL,
    "sealedRestricted" TEXT,
    "hasRestricted" BOOLEAN NOT NULL DEFAULT false,
    "recordedBySub" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "type" "ChangeType" NOT NULL,
    "state" "ChangeState" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "initiatorSub" TEXT NOT NULL,
    "initiatorName" TEXT NOT NULL,
    "initiatorRole" TEXT NOT NULL,
    "subjectSub" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "grantedRole" TEXT NOT NULL,
    "custodianOrgId" TEXT NOT NULL,
    "quorumThreshold" INTEGER NOT NULL,
    "noticePdfHash" TEXT,
    "noticeIssuedAt" TIMESTAMP(3),
    "ministerConsent" BOOLEAN NOT NULL DEFAULT false,
    "ministerConsentBy" TEXT,
    "ministerConsentAt" TIMESTAMP(3),
    "tideGrantRef" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "custodianSub" TEXT NOT NULL,
    "custodianName" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "signatureRef" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_document" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBySub" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,

    CONSTRAINT "notice_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "seq" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorSub" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRoles" TEXT[],
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "clearance_check" (
    "id" TEXT NOT NULL,
    "actorSub" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "cells" TEXT[],
    "hitRefs" TEXT[],
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ref" (
    "sub" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "devRoles" TEXT[],
    "blurb" TEXT NOT NULL DEFAULT '',
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ref_pkey" PRIMARY KEY ("sub")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_publicRef_key" ON "place"("publicRef");

-- CreateIndex
CREATE INDEX "place_custodianOrgId_idx" ON "place"("custodianOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "change_request_ref_key" ON "change_request"("ref");

-- CreateIndex
CREATE INDEX "change_request_placeId_idx" ON "change_request"("placeId");

-- CreateIndex
CREATE INDEX "change_request_state_idx" ON "change_request"("state");

-- CreateIndex
CREATE INDEX "change_request_subjectSub_idx" ON "change_request"("subjectSub");

-- CreateIndex
CREATE INDEX "approval_changeRequestId_idx" ON "approval"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_changeRequestId_custodianSub_key" ON "approval"("changeRequestId", "custodianSub");

-- CreateIndex
CREATE INDEX "notice_document_changeRequestId_idx" ON "notice_document"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_event_hash_key" ON "audit_event"("hash");

-- CreateIndex
CREATE INDEX "audit_event_action_idx" ON "audit_event"("action");

-- CreateIndex
CREATE INDEX "audit_event_at_idx" ON "audit_event"("at");

-- CreateIndex
CREATE INDEX "clearance_check_actorSub_idx" ON "clearance_check"("actorSub");

-- CreateIndex
CREATE UNIQUE INDEX "user_ref_username_key" ON "user_ref"("username");

-- AddForeignKey
ALTER TABLE "place" ADD CONSTRAINT "place_custodianOrgId_fkey" FOREIGN KEY ("custodianOrgId") REFERENCES "custodian_org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_custodianOrgId_fkey" FOREIGN KEY ("custodianOrgId") REFERENCES "custodian_org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_document" ADD CONSTRAINT "notice_document_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
