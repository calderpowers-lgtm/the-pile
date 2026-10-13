# The Pile

Gratitude practice.

If everyone wrote their problems on a sheet of paper and piled them together, most of us would take our own sheet back. The Pile is a phone-first way to try that: write yours, draw one person from the world, and decide.

Your words stay in this browser on this device. There is no account and no cloud sync. Mood, journal entries, your name, and your sheet are never uploaded. A drawn sheet is not a diary and not an identified person. It is a factual profile: age, sex, and country from the world population, then income, savings, health, and other circumstances sampled from cited public statistics for that place.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The dev server listens on all interfaces at port **43123**, so a phone on the same network can use this machine’s address. Local and private-network hosts are allowed in dev so the page stays interactive.

Other scripts:

```bash
npm test        # sampling consistency and citations
npm run lint
npm run build   # static export in out/
```

`output: 'export'` writes a static site. `next start` does not serve that export. For a production check, serve the `out` directory. GitHub Pages builds with `BASE_PATH=/the-pile` (see `.github/workflows/pages.yml`). Leave `BASE_PATH` empty for a site at the domain root.

Refresh the bundled numbers with `python3 scripts/fetch_dataset.py`. The script reads official downloads and writes `src/data/pile-dataset.json`. Raw files stay in `data/cache/` and are not committed.

## Install on a phone

Use the GitHub Pages site, or serve the static export over HTTPS. Dev mode does not register the service worker.

**iPhone (Safari)**  
Share → **Add to Home Screen**. The icon is The Pile. It opens full screen, without the Safari toolbar.

**Android (Chrome)**  
Browser menu → **Install app** or **Add to Home screen**.

The manifest, icons, and service worker use the same base path as the build, so a Pages install is scoped to `/the-pile/`.

## What’s in the practice

1. A short introduction, plus a first-run explanation that everything you write stays on this phone. The same explanation is under **Private**.
2. **How are you today?** — 1 to 10.
3. **Dump it on the pile**, also a journal. One open page. You can optionally save that entry on this phone for later. The draft autosaves in `localStorage`.
4. **Three things you’re grateful for today.**
5. A local profile, kept light: optional name and age band under Private. Stored on this device only.
6. Draw one person. The draw happens in the browser from the bundled dataset. Nothing is sent to a server.
7. A readable card: age and sex, place, then a list of facts. Each line shows the number and a citation (source, indicator, year, geography). Tap a line for how it was drawn. Sources are listed at the bottom.
8. **Take mine back**, or **Keep looking**.
9. History of draws, and a journal of entries you chose to keep, both on this device.

## How a person is drawn

The sampler is `src/lib/profile/sample.ts`. The dataset is `src/data/pile-dataset.json`, built by `scripts/fetch_dataset.py`.

Order, so later facts stay consistent with earlier ones:

- Country, with probability proportional to UN WPP 2024 population (1 January, medium variant).
- Age and sex together, from that country’s five-year population pyramid. Children are included.
- Urban or rural, from the World Bank urban population share, when that series exists.
- Income percentile, uniform from 1 to 100. The amount is the average of that decile (published decile share × mean / 0.1) from World Bank PIP, 2021 PPP. The $3.00, $4.20, and $8.30 lines are applied to that decile average. The national headcount is shown beside it. Local currency uses the PIP PPP factor, not a market exchange rate. If the country has no survey row, the sheet uses a labeled population-weighted regional or income-group average, or a World Bank filled-gap series.
- From age 15, Global Findex 2025: account by sex, and saved-any-money plus emergency funds by poorest 40% or richest 60%, matching the percentile already drawn.
- From age 20, estimated net wealth from WID (`ahwealj992`), using the same decile as income. The sheet says that assumes rank correlation of 1.
- Children: women, from UN WPP age-specific fertility, Poisson around the exposure mean and capped at age minus 10. Under 10, zero. Men are not assigned a count, because WPP does not publish male fertility.
- Health and other items only inside the age and sex the series describes. Prevalence can be a yes or no. Incidence, maternal mortality, the UHC index, out-of-pocket spending, and mobile subscriptions per 100 are shown as rates and are not turned into a second yes or no.

Missing country series fall back to the World Bank region or income group and the geography line says so. If there is no fallback, the item is omitted. Household size, marital status, anxiety prevalence, and separate Gallup stress, worry, and sadness are gaps: the sheet says they are not estimated or not shown. `src/data/pile-gaps.json` lists what the fetch could not source.

Every displayed figure has a source, indicator, year, geography, URL, and retrieval date. The tests in `src/lib/profile/sheet.test.ts` check that, and that a repeated seed draws the same person.
