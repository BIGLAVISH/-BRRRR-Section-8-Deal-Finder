# BCA BRRRR + Section 8 Daily Deal Finder

## Fastest setup

1. Download and unzip this package.
2. Create a NEW GitHub repository.
3. Upload every file/folder from this package into that repo.
4. Go to **Actions**.
5. Tap **Daily BRRRR Section 8 Deal Finder**.
6. Tap **Run workflow**.
7. Connect the repo to Netlify.
8. Netlify settings:
   - Build command: leave blank
   - Publish directory: `/`
9. Open your Netlify link on your phone.
10. Tap Share → Add to Home Screen.

## What this clean package does

- Runs daily through GitHub Actions.
- No npm install required.
- No Node dependencies.
- Reads deal sources from `data/sources.json`.
- Starts with `data/sample_source.csv`.
- Filters 1–20 unit deals.
- Scores BRRRR + Section 8 opportunities.
- Creates:
  - `data/deals.json`
  - `data/deals.csv`
  - `data/run_log.json`
- Netlify displays the latest deals as a mobile-friendly app.

## Legal / data note

Use permitted sources only:
- Your CSV exports
- County open data
- Wholesaler feeds
- Public APIs you are allowed to use
- Data providers you pay for and are allowed to export

Do not bypass logins, paywalls, captchas, robots.txt, or website terms.

## Adding real deal feeds

Edit `data/sources.json`.

Supported:
- `local_csv`
- `csv_url`
- `json_url`

Example:

```json
{
  "name": "My PropStream Export",
  "type": "local_csv",
  "path": "data/my_propstream_export.csv",
  "enabled": true
}
```

