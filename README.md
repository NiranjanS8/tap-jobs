# TAP Academy Job Notifier

Checks TAP Academy's own job-listings API every 3 hours and emails you when a new
job posting appears.

## How it works
Turns out the dashboard calls a plain, public JSON API internally:

```
GET https://drives.thetapacademy.com/api/general/get-active-drives?filters[isTechnical]=true&limit=50&page=1
```

No login or auth token required. `scrape.js` calls this directly, compares the returned
`jobId`s to the list saved from the last run (`state.json`, committed back to the repo
each time), and emails you about any IDs that weren't there before.

This is much lighter than browser-based scraping — no headless browser download, runs
in a couple of seconds, so it's cheap to run frequently.

## Setup (5 minutes)

1. **Create a new GitHub repo** and push this folder to it.
   ```
   cd tap-job-notifier
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Create a Gmail App Password** (don't use your real Gmail password):
   - Go to https://myaccount.google.com/apppasswords
   - Generate an app password for "Mail"
   - Copy the 16-character password

3. **Add repo secrets** (GitHub repo → Settings → Secrets and variables → Actions → New repository secret):
   - `EMAIL_USER` → your Gmail address (the account that sends the email)
   - `EMAIL_PASS` → the 16-character app password from step 2
   - `EMAIL_TO` → the email address you want notifications sent to (can be the same as EMAIL_USER)

4. **Enable workflow write permissions** (required so the workflow can commit `state.json` back):
   - GitHub repo → **Settings** → **Actions** → **General**
   - Scroll to **Workflow permissions** → select **Read and write permissions**
   - Click **Save**

5. **Trigger it once manually** to confirm it works: GitHub repo → **Actions** tab →
   "Check TAP Academy Job Postings" → **Run workflow**.

6. Done. It now runs automatically every 3 hours. The first run just saves a baseline
   of currently active jobs (no email); every run after that only emails you about
   postings that weren't there before.

## Adjusting things
- **Schedule**: edit the `cron` line in `.github/workflows/check-jobs.yml`. Cron times
  are UTC. Free-tier scheduled workflows can occasionally run a few minutes late during
  GitHub's high-load periods — that's a platform limitation, not a bug here.
- **Non-technical roles too**: the API call filters `isTechnical=true`. Remove that
  query param (or set it to `false`) in `API_URL` inside `scrape.js` if you want
  non-technical drives included too, or run both in parallel.
- **Include expired/closed drives**: the API returns some already-expired jobs mixed
  in (sorted newest-first) — the script doesn't filter these out itself, so a very
  recently-expired posting could still trigger a "new" email the first time it's seen.
  If that's noisy, add a check on `expired` in `fetchJobs()`.

## Troubleshooting
- **No email arriving**: check Actions tab → latest run → logs — it'll say
  "No new jobs found" (working correctly) vs. a real error.
- **Gmail blocks it**: use an App Password, not your normal password, and make sure
  2-Step Verification is enabled on the Google account (required for App Passwords).
- **API shape changes**: if TAP Academy changes their API response format, adjust the
  field names in `fetchJobs()` in `scrape.js` accordingly.
