import { prisma } from "../../infrastructure/database/prisma.js";

export const getOwnedDashboardCounts = async (userId: string) => {
  const [
    totalJobs,
    activeJobs,
    completedJobs,
    failedJobs,
    totalLeads,
    leadsWithPhone,
    leadsWithEmail,
  ] = await prisma.$transaction([
    prisma.scrapingJob.count({ where: { userId } }),
    prisma.scrapingJob.count({
      where: { userId, status: { in: ["PENDING", "QUEUED", "RUNNING"] } },
    }),
    prisma.scrapingJob.count({ where: { userId, status: "COMPLETED" } }),
    prisma.scrapingJob.count({ where: { userId, status: "FAILED" } }),
    prisma.lead.count({ where: { userId } }),
    prisma.lead.count({ where: { userId, phoneRaw: { not: null } } }),
    prisma.lead.count({ where: { userId, email: { not: null } } }),
  ]);

  return {
    totalJobs,
    activeJobs,
    completedJobs,
    failedJobs,
    totalLeads,
    leadsWithPhone,
    leadsWithEmail,
  };
};
