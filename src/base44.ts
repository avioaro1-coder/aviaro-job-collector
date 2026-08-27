import type { NormalizedJob } from "./types.js";

const BASE44_SYNC_URL =
  "https://aviaro-career-path.base44.app/functions/syncEmiratesJobs";

export async function syncJobsToBase44(
  jobs: NormalizedJob[],
): Promise<void> {
  const secret = process.env.JOBS_SYNC_SECRET;

  if (!secret) {
    throw new Error(
      "JOBS_SYNC_SECRET is not configured.",
    );
  }

  console.log(`Sending ${jobs.length} jobs to Base44...`);

  const response = await fetch(BASE44_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": secret,
    },
    body: JSON.stringify({ jobs }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Base44 sync failed (${response.status}): ${responseText}`,
    );
  }

  console.log("Base44 sync successful:");
  console.log(responseText);
}