/**
 * Job requirements structure matching Base44's Job entity
 */
export interface JobRequirements {
  min_total_hours?: number;
  min_pic_hours?: number;
  min_sic_hours?: number;
  min_multi_engine_hours?: number;
  min_jet_hours?: number;
  required_licence?: string;
  required_ratings?: string[];
  required_medical?: "class1" | "class2" | "none";
  work_rights?: string[];
  required_type_rating?: string;
  experience_level?:
    | "entry"
    | "first_officer"
    | "captain"
    | "type_rated"
    | "experienced";
}

/**
 * Preferred (non-mandatory) qualifications, matching Base44's Job entity
 */
export interface JobPreferred {
  additional_aircraft?: string[];
  languages?: string[];
  location_preference?: string[];
}

/**
 * A single screening question, matching Base44's Job entity
 */
export interface JobQuestion {
  question: string;
  type?: "text" | "boolean";
}

/**
 * Normalized job structure for all collectors
 */
export interface NormalizedJob {
  company_id: string;
  company_name: string;
  position: string;
  location: string;
  region: string;
  aircraft: string;
  contract_type: string;
  employment_type: string;
  salary: string;
  salary_min: number | null;
  requirements: JobRequirements;
  preferred: JobPreferred;
  closing_date: string | null;
  application_method: string;
  external_url: string;
  description: string;
  questions: JobQuestion[];
  status: "active" | "closed";
  is_sample: boolean;
  // Metadata
  source: string;
  source_url: string;
  source_type: "Direct Airline" | "Job Board" | "Other";
  external_job_id: string;
  job_fingerprint: string;
  first_seen: string; // ISO 8601 timestamp
  last_checked: string; // ISO 8601 timestamp
  last_changed: string; // ISO 8601 timestamp
}

/**
 * Raw job data from Emirates careers site before normalization
 */
export interface RawEmiratesJob {
  id: string;
  title: string;
  url: string;
  location?: string;
  category?: string;
  description?: string;
  requirements?: string;
  preferred?: string;
  aircraft?: string;
  salary?: string;
  contractType?: string;
  closingDate?: string;
}

/**
 * Collector result
 */
export interface CollectorResult {
  timestamp: string;
  source: string;
  statistics: {
    discovered: number;
    added: number;
    updated: number;
    unchanged: number;
    closed: number;
    errors: number;
  };
  jobs: NormalizedJob[];
  logs: string[];
  errors: Array<{
    url?: string;
    message: string;
  }>;
}