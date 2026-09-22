-- Initial AIAP database schema.

CREATE TYPE "Role" AS ENUM ('MEMBER','PRESIDENT','SECRETARIAT','TREASURER','COMMUNICATION','SUPER_ADMIN','EVENT_ORGANIZER','VICE_PRESIDENT','COORDINATOR');
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING','ACTIVE','SUSPENDED','INACTIVE','REJECTED');
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT','PENDING','APPROVED','REJECTED');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED','CANCELLED','COMPLETED');
CREATE TYPE "TransactionType" AS ENUM ('INCOME','EXPENSE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "emailVerifiedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "memberNumber" TEXT,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "photoUrl" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "phone" TEXT,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "status" TEXT NOT NULL,
  "university" TEXT,
  "fieldOfStudy" TEXT,
  "profession" TEXT,
  "emergencyName" TEXT,
  "emergencyPhone" TEXT,
  "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
  "publicProfile" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");
CREATE INDEX "Member_city_idx" ON "Member"("city");
CREATE INDEX "Member_university_idx" ON "Member"("university");
CREATE INDEX "Member_fieldOfStudy_idx" ON "Member"("fieldOfStudy");
CREATE INDEX "Member_membershipStatus_idx" ON "Member"("membershipStatus");

CREATE TABLE "Registration" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "description" TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Activity_slug_key" ON "Activity"("slug");

CREATE TABLE "ActivityImage" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
  "altText" TEXT,
  "caption" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ActivityImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityImage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "location" TEXT,
  "coverImageUrl" TEXT,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventRegistration" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EventRegistration_eventId_memberId_key" ON "EventRegistration"("eventId","memberId");

CREATE TABLE "EventPlan" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "objective" TEXT,
  "expectedAttendance" INTEGER,
  "audience" TEXT,
  "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "venueDetails" TEXT,
  "transportPlan" TEXT,
  "accommodationPlan" TEXT,
  "cateringPlan" TEXT,
  "securityPlan" TEXT,
  "communicationsPlan" TEXT,
  "contingencyPlan" TEXT,
  "program" TEXT,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventPlan_eventId_key" UNIQUE ("eventId"),
  CONSTRAINT "EventPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EventPlan_eventId_idx" ON "EventPlan"("eventId");

CREATE TABLE "EventPlanTask" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignee" TEXT,
  "dueAt" TIMESTAMP(3),
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventPlanTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventPlanTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EventPlanTask_planId_idx" ON "EventPlanTask"("planId");

CREATE TABLE "ActivityParticipation" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityParticipation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityParticipation_activityId_memberId_key" ON "ActivityParticipation"("activityId","memberId");
CREATE INDEX "ActivityParticipation_activityId_idx" ON "ActivityParticipation"("activityId");
CREATE INDEX "ActivityParticipation_memberId_idx" ON "ActivityParticipation"("memberId");
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contribution" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "receiptUrl" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
