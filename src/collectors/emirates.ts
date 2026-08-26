import * as cheerio from "cheerio";
import type { NormalizedJob, RawEmiratesJob } from "../types.js";

const PILOT_SEARCH_URL =
  "https://www.emiratesgroupcareers.com/search-and-apply/?jobcategory=Pilots";

const SOURCE = "Emirates Group Careers";
const SOURCE_TYPE = "Direct Airline";

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function fingerprint(job: {
  external_job_id?: string;
  external_url: string;
  position: string;
  location: string;
}): string {
  const base = [
    job.external_job_id || "",
    job.external_url,
    job.position,
    job.location,
  ]
    .join("|")
    .toLowerCase()
    .trim();

  // Simple deterministic fingerprint.
  let hash = 0;

  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }

  return `emirates-${Math.abs(hash)}`;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Aviaro Job Collector/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Emirates request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

function extractPilotLinks(html: string): RawEmiratesJob[] {
  const $ = cheerio.load(html);
  const jobs: RawEmiratesJob[] = [];

  $("a").each((_, element) => {
    const link = $(element);
    const title = cleanText(link.text());
    const href = link.attr("href");

    if (!href || !title) return;

    const lowerTitle = title.toLowerCase();

    // Only collect obvious pilot roles.
    const isPilotRole =
      lowerTitle.includes("pilot") ||
      lowerTitle.includes("first officer") ||
      lowerTitle.includes("captain") ||
      lowerTitle.includes("accelerated command") ||
      lowerTitle.includes("cadet");

    if (!isPilotRole) return;

    const url = new URL(href, PILOT_SEARCH_URL).toString();

    jobs.push({
      id: url,
      title,
      url,
    });
  });

  // Remove duplicate links.
  const unique = new Map<string, RawEmiratesJob>();

  for (const job of jobs) {
    unique.set(job.url, job);
  }

  return [...unique.values()];
}

function normalizeJob(
  raw: RawEmiratesJob,
  description = "",
): NormalizedJob {
  const now = new Date().toISOString();

  const normalized = {
    company_name: "Emirates",
    position: cleanText(raw.title),
    location: cleanText(raw.location),
    region: "",
    aircraft: "",
    contract_type: "",
    employment_type: "",
    salary: "",
    salary_min: null,
    requirements: "",
    preferred: "",
    closing_date: null,
    application_method: "External application",
    external_url: raw.url,
    description: cleanText(description),
    questions: "",
    status: "active" as const,
    is_sample: false,

    source: SOURCE,
    source_url: raw.url,
    source_type: SOURCE_TYPE as "Direct Airline",
    external_job_id: raw.id,
    job_fingerprint: fingerprint({
      external_job_id: raw.id,
      external_url: raw.url,
      position: raw.title,
      location: raw.location ?? "",
    }),
    first_seen: now,
    last_checked: now,
    last_changed: now,
  };

  return normalized;
}

export async function collectEmiratesPilotJobs(): Promise<NormalizedJob[]> {
  console.log(`Fetching Emirates pilot vacancies...`);
  console.log(`Source: ${PILOT_SEARCH_URL}`);

  const searchHtml = await fetchPage(PILOT_SEARCH_URL);

  const rawJobs = extractPilotLinks(searchHtml);

  console.log(`Found ${rawJobs.length} possible pilot vacancies.`);

  const jobs: NormalizedJob[] = [];

  for (const rawJob of rawJobs) {
    try {
      console.log(`Processing: ${rawJob.title}`);

      const jobHtml = await fetchPage(rawJob.url);
      const $ = cheerio.load(jobHtml);

      const description = cleanText($("main").text());

      jobs.push(normalizeJob(rawJob, description));
    } catch (error) {
      console.error(
        `Failed to process ${rawJob.title}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return jobs;
}
