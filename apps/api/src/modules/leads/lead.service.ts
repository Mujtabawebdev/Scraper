import { createPaginationMetadata } from "../scraping-jobs/scraping-job.mapper.js";
import { leadNotFoundError } from "./lead.errors.js";
import { mapLeadDetail, mapLeadSummary } from "./lead.mapper.js";
import {
  findOwnedLeadDetail,
  listOwnedLeads,
} from "./lead.repository.js";
import type { ListLeadsQuery } from "./lead.types.js";

export const listLeads = async (userId: string, query: ListLeadsQuery) => {
  const result = await listOwnedLeads(userId, query);
  return {
    leads: result.leads.map(mapLeadSummary),
    pagination: createPaginationMetadata(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getLead = async (userId: string, leadId: string) => {
  const lead = await findOwnedLeadDetail(leadId, userId);
  if (!lead) throw leadNotFoundError();
  return mapLeadDetail(lead);
};
