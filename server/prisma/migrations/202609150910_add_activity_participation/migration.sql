CREATE TABLE "ActivityParticipation" ("id" TEXT NOT NULL,"activityId" TEXT NOT NULL,"memberId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ActivityParticipation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ActivityParticipation_activityId_memberId_key" ON "ActivityParticipation"("activityId","memberId");
CREATE INDEX "ActivityParticipation_activityId_idx" ON "ActivityParticipation"("activityId");
CREATE INDEX "ActivityParticipation_memberId_idx" ON "ActivityParticipation"("memberId");
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
