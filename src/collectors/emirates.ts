import * as cheerio from "cheerio";
import type { NormalizedJob, RawEmiratesJob } from "../types.js";

const SEARCH_URL =
  "https://www.emiratesgroupcareers.com/search-and-apply/?jobcategory=Pilots";

const EMIRATES_COMPANY_ID = "6a900910c22ed4ee7e199dde";

const ROLE_URLS = [
  {
    title: "Direct Entry Captain",
    url: "https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=Direct-Entry-Captains",
  },
  {
    title: "Accelerated Command",
    url: "https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=Accelerated-Command",
  },
  {
    title: "First Officer",
    url: "https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=first-officers",
  },
  {
    title: "National Cadet Pilot Programme",
    url: "https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=national-cadet-pilot-programme",
  },
];

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Aviaro Job Collector/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

function makeFingerprint(url: string): string {
  let hash = 0;

  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }

  return `emirates-${Math.abs(hash)}`;
}

function buildJob(title: string, url: string, html: string): NormalizedJob {
  const $ = cheerio.load(html);

  const pageText = cleanText($("main").text() || $("body").text());

  let requirements: NormalizedJob["requirements"] = {};

  if (title === "First Officer") {
    requirements = {
      min_total_hours: 2000,
      required_licence: "ICAO ATPL with unrestricted Class 1 medical",
      required_type_rating: "Current Boeing or Airbus FBW experience",
      experience_level: "first_officer",
    };
  }

  if (title === "Accelerated Command") {
    requirements = {
      min_total_hours: 5000,
      required_licence: "ICAO ATPL with unrestricted Class 1 medical",
      required_type_rating: "Pilot in Command Airbus FBW/Boeing experience",
      experience_level: "captain",
    };
  }

  if (title === "National Cadet Pilot Programme") {
    requirements = {
      required_licence: "None (cadet entry programme)",
      experience_level: "entry",
    };
  }

  if (title === "Direct Entry Captain") {
    requirements = {
      min_total_hours: 7000,
      required_licence: "ICAO ATPL with unrestricted Class 1 medical",
      required_type_rating: "Relevant Airbus FBW/Boeing experience",
      experience_level: "captain",
    };
  }

  const now = new Date().toISOString();

  const raw: RawEmiratesJob = {
    id: url,
    title,
    url,
    location: "Dubai, United Arab Emirates",
    description: pageText,
  };

  return {
    company_id: EMIRATES_COMPANY_ID,
    company_name: "Emirates",
    position: title,
    location: "Dubai, United Arab Emirates",
    region: "Middle East",
    aircraft:
      title === "First Officer" || title === "Accelerated Command"
        ? "Airbus / Boeing"
        : "",
    contract_type: "Permanent",
    employment_type: "Full-time",
    salary: "",
    salary_min: null,
    requirements,
    preferred: {},
    closing_date: null,
    application_method: "External application",
    external_url: raw.url,
    description: pageText,
    questions: [],
    status: "active",
    is_sample: false,

    source: "Emirates Group Careers",
    source_url: SEARCH_URL,
    source_type: "Direct Airline",
    external_job_id: url,
    job_fingerprint: makeFingerprint(url),
    first_seen: now,
    last_checked: now,
    last_changed: now,
  };
}

export async function collectEmiratesPilotJobs(): Promise<NormalizedJob[]> {
  console.log("Fetching Emirates pilot vacancies...");
  console.log(`Source: ${SEARCH_URL}`);

  // Verify the official search page is accessible.
  const searchHtml = await fetchPage(SEARCH_URL);

  if (!searchHtml.toLowerCase().includes("direct entry captain")) {
    console.warn(
      "Warning: expected pilot roles were not found in the search-page HTML.",
    );
  }

  console.log("Using the four official Emirates pilot role pages.");

  const jobs: NormalizedJob[] = [];

  for (const role of ROLE_URLS) {
    try {
      console.log(`Processing: ${role.title}`);

      const html = await fetchPage(role.url);

      const job = buildJob(role.title, role.url, html);

      jobs.push(job);

      console.log(`✓ ${role.title}`);
    } catch (error) {
      console.error(
        `✗ Failed: ${role.title}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return jobs;
}