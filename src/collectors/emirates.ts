import * as cheerio from "cheerio";
import type { NormalizedJob, RawEmiratesJob } from "../types.js";

const PILOT_SEARCH_URL =
  "https://www.emiratesgroupcareers.com/search-and-apply/?jobcategory=Pilots";

const SOURCE = "Emirates Group Careers";
const SOURCE_TYPE = "Direct Airline";

const ROLE_SLUGS = [
  "direct-entry-captains",
  "accelerated-command",
  "first-officers",
  "national-cadet-pilot-programme",
];

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function fingerprint(job: {
  external_job_id: string;
  external_url: string;
}): string {
  const base = `${job.external_job_id}|${job.external_url}`.toLowerCase();

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
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

function roleUrl(slug: string): string {
  return `https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=${slug}`;
}

function extractRoleLinks(html: string): RawEmiratesJob[] {
  const $ = cheerio.load(html);
  const jobs: RawEmiratesJob[] = [];

  $("a[href]").each((_, element) => {
    const link = $(element);
    const href = link.attr("href");

    if (!href) return;

    const url = new URL(href, PILOT_SEARCH_URL).toString();

    if (!url.includes("/pilots/our-role-details/")) return;

    const title = cleanText(link.text());

    if (!title) return;

    jobs.push({
      id: url,
      title,
      url,
      location: "Dubai, United Arab Emirates",
    });
  });

  const unique = new Map<string, RawEmiratesJob>();

  for (const job of jobs) {
    unique.set(job.url, job);
  }

  return [...unique.values()];
}

function extractPageText($: cheerio.CheerioAPI): string {
  return cleanText($("main").text());
}

function extractRequirements($: cheerio.CheerioAPI): string {
  const requirements: string[] = [];

  $("body")
    .find("*")
    .each((_, element) => {
      const text = cleanText($(element).text());

      if (
        text.match(/valid ICAO ATPL/i) ||
        text.match(/total flying time/i) ||
        text.match(/minimum .* hours/i) ||
        text.match(/ELP [45]/i) ||
        text.match(/UAE passport/i) ||
        text.match(/IELTS/i)
      ) {
        if (text.length < 500) {
          requirements.push(text);
        }
      }
    });

  return [...new Set(requirements)].join(" | ");
}

function extractSalary(text: string): string {
  const matches = text.match(
    /(?:Annual pay & benefits|Annual take home cash|Monthly take home cash)[\s\S]{0,100}?AED\s?[\d,]+/gi,
  );

  if (!matches) return "";

  return matches.map(cleanText).join(" | ");
}

function normalizeJob(
  raw: RawEmiratesJob,
  description: string,
  requirements: string,
  salary: string,
): NormalizedJob {
  const now = new Date().toISOString();

  return {
    company_name: "Emirates",
    position: cleanText(raw.title),
    location: raw.location ?? "Dubai, United Arab Emirates",
    region: "Middle East",
    aircraft: "",
    contract_type: "Permanent",
    employment_type: "Full-time",
    salary,
    salary_min: null,
    requirements,
    preferred: "",
    closing_date: null,
    application_method: "External application",
    external_url: raw.url,
    description,
    questions: "",
    status: "active",
    is_sample: false,

    source: SOURCE,
    source_url: raw.url,
    source_type: SOURCE_TYPE,
    external_job_id: raw.id,
    job_fingerprint: fingerprint({
      external_job_id: raw.id,
      external_url: raw.url,
    }),
    first_seen: now,
    last_checked: now,
    last_changed: now,
  };
}

export async function collectEmiratesPilotJobs(): Promise<NormalizedJob[]> {
  console.log("Fetching Emirates pilot vacancies...");
  console.log(`Source: ${PILOT_SEARCH_URL}`);

  // First inspect the actual Emirates pilot search page.
  const searchHtml = await fetchPage(PILOT_SEARCH_URL);

  const discoveredJobs = extractRoleLinks(searchHtml);

  console.log(
    `Found ${discoveredJobs.length} role links directly on the search page.`,
  );

  // Emirates currently exposes these four pilot roles.
  // We use the known public role pages as a fallback if the search page
  // does not expose their links in the raw HTML.
  const jobsToProcess =
    discoveredJobs.length > 0
      ? discoveredJobs
      : ROLE_SLUGS.map((slug) => ({
          id: roleUrl(slug),
          title: slug,
          url: roleUrl(slug),
          location: "Dubai, United Arab Emirates",
        }));

  const uniqueJobs = new Map<string, RawEmiratesJob>();

  for (const job of jobsToProcess) {
    uniqueJobs.set(job.url, job);
  }

  console.log(`Processing ${uniqueJobs.size} Emirates pilot roles.`);

  const jobs: NormalizedJob[] = [];

  for (const rawJob of uniqueJobs.values()) {
    try {
      console.log(`Processing: ${rawJob.url}`);

      const jobHtml = await fetchPage(rawJob.url);
      const $ = cheerio.load(jobHtml);

      const pageText = extractPageText($);

      let position = rawJob.title;

      if (pageText.match(/Enter a new career era/i)) {
        position = "First Officer";
      } else if (pageText.match(/Captain's seat/i)) {
        position = "Direct Entry Captain";
      } else if (pageText.match(/Ready for the next step/i)) {
        position = "Accelerated Command";
      } else if (pageText.match(/Become a world-class pilot/i)) {
        position = "National Cadet Pilot Programme";
      }

      const normalizedRawJob = {
        ...rawJob,
        title: position,
      };

      const requirements = extractRequirements($);
      const salary = extractSalary(pageText);

      jobs.push(
        normalizeJob(
          normalizedRawJob,
          pageText,
          requirements,
          salary,
        ),
      );
    } catch (error) {
      console.error(
        `Failed to process ${rawJob.url}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return jobs;
}
