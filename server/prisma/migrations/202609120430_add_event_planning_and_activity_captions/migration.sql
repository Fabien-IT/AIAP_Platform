-- Add event organizer role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EVENT_ORGANIZER';

-- Add captions to activity media
ALTER TABLE "ActivityImage" ADD COLUMN IF NOT EXISTS "caption" TEXT;

CREATE TABLE IF NOT EXISTS "EventPlan" (
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
CREATE INDEX IF NOT EXISTS "EventPlan_eventId_idx" ON "EventPlan"("eventId");

CREATE TABLE IF NOT EXISTS "EventPlanTask" (
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
CREATE INDEX IF NOT EXISTS "EventPlanTask_planId_idx" ON "EventPlanTask"("planId");
