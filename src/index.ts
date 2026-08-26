import { collectEmiratesPilotJobs } from "./collectors/emirates.js";

async function main() {
  try {
    const jobs = await collectEmiratesPilotJobs();

    console.log("\n==============================");
    console.log(`Found ${jobs.length} Emirates pilot jobs`);
    console.log("==============================\n");

    console.log(JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error("Collector failed:");

    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main();
