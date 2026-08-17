// scrape.js
// Polls TAP Academy's own (public, unauthenticated) job-listing API and emails you
// when a job ID shows up that wasn't there on the last run.

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const API_URL =
  "https://drives.thetapacademy.com/api/general/get-active-drives?filters[isTechnical]=true&limit=50&page=1";
const STATE_FILE = path.join(__dirname, "state.json");

function loadPreviousState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) return res;

    console.warn(`Attempt ${attempt}/${retries} failed: ${res.status} ${res.statusText}`);
    if (attempt < retries) {
      const delayMs = attempt * 5000;
      console.log(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    } else {
      throw new Error(`API request failed after ${retries} attempts: ${res.status} ${res.statusText}`);
    }
  }
}

async function fetchJobs() {
  const res = await fetchWithRetry(API_URL);
  const json = await res.json();

  const jobs = {};
  for (const job of json.data) {
    jobs[job.jobId] = {
      title: job.jobTitle,
      location: (job.jobLocation || []).join(", "),
      package: job.package,
      qualification: (job.qualification || []).join(", "),
      createdAt: job.createdAt,
      expired: job.expired,
    };
  }
  return jobs;
}

async function sendEmail(newJobs) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password, not your normal password
    },
  });

  const listHtml = Object.entries(newJobs)
    .map(
      ([id, j]) =>
        `<li><b>TAP-JOB-ID-${id}</b> — ${j.title}<br>` +
        `📍 ${j.location} | 💰 up to ${j.package} LPA | 🎓 ${j.qualification}<br>` +
        `<a href="https://drives.thetapacademy.com/">View on dashboard</a></li>`
    )
    .join("<br>");

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `🔔 ${Object.keys(newJobs).length} new TAP Academy job posting(s)`,
    html: `<p>New postings found:</p><ul>${listHtml}</ul>`,
  });

  console.log(`Email sent for ${Object.keys(newJobs).length} new job(s).`);
}

(async () => {
  const previous = loadPreviousState();
  const isFirstRun = Object.keys(previous).length === 0;
  const current = await fetchJobs();

  const newJobIds = Object.keys(current).filter((id) => !(id in previous));

  if (isFirstRun) {
    console.log(`First run — saving baseline of ${Object.keys(current).length} job(s), no email sent.`);
  } else if (newJobIds.length === 0) {
    console.log("No new jobs found.");
  } else {
    const newJobs = {};
    newJobIds.forEach((id) => (newJobs[id] = current[id]));
    console.log("New jobs found:", newJobIds);
    await sendEmail(newJobs);
  }

  saveState(current);
})().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
