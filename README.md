# GPA Calculator

A web application for recording course marks and calculating course grades, SGPA, CGPA, and credit totals.

The application supports guest-only browser storage and optional account-based cloud storage through Cloudflare Workers and D1.

## Features

- Add, rename, and delete semesters
- Add theory or theory-and-lab courses
- Enter course credits and theory/lab credit splits
- Set assignment, quiz, midterm, and final weights
- Add marks with custom maximum scores
- Calculate course percentage, letter grade, and grade point
- Calculate SGPA for one selected semester
- Calculate CGPA across the current semesters and previous semesters
- Mark results as provisional while course components are incomplete
- Customize the percentage-to-grade-scale table
- Export account or guest data as `gpa-data.json`
- Save account data in Cloudflare D1
- Queue failed or offline account updates and retry them later

## Requirements

- Node.js 20 or later
- npm
- A Cloudflare account for remote D1 deployment
- Wrangler CLI access for database and Worker deployment

## Run locally

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Open the address printed by Vite. The default address is usually `http://localhost:5173`.

## How to use the calculator

### Guest mode

Open the application without logging in to use guest mode.

1. Add a semester with **+ Semester**.
2. Open the semester and select **+ Add Course**.
3. Enter the course name and total credits.
4. Enable **Has Lab** if the course has separate theory and lab credits.
5. Set the grading weights for the theory and lab sections.
6. Add marks to each course component.
7. Enter the obtained marks and the maximum marks for each item.

Guest data is stored in browser `localStorage`. It is not sent to the server and is only available in that browser profile.

### Create an account

Select **Login** in the header and open **Create Account**.

Enter:

- Full name
- Roll number in `SP` or `FA` format, for example `SP26-BCS-114`
- Password

After registration, the application creates a D1 account and session. Existing guest data can be copied to the new account when the sync option is selected.

The application will not add an account to the database if the roll number is already registered.

### Log in

Use the same roll number and password on the login screen.

When an account is authenticated, the application:

- Loads the account cache if available
- Syncs queued offline changes
- Downloads the latest account data from D1
- Replaces or updates the browser cache

### Add and edit courses

For each course, enter:

- Course name
- Total course credits
- Theory credits and lab credits when the course has a lab
- Weights for assignment, quiz, midterm, and final components

For theory and lab weight tables, the visible total should be 100. The application warns when the weights do not equal 100.

### Add marks

Each mark entry contains:

- Part: theory or lab
- Type: assignment, quiz, midterm, or final
- Optional label
- Obtained marks
- Maximum marks

Obtained marks cannot exceed maximum marks. Leaving obtained marks empty means that the component has not been entered.

### Add previous semesters

Open the previous-semester card on the dashboard.

Enter each previous semester's:

- Name
- Credit total
- SGPA

Previous semesters are included in CGPA calculations but are kept separate from the semesters shown on the dashboard.

### Export data

Open **Profile** for an account or **Settings** for guest mode, then select **Export data**.

The export is downloaded as `gpa-data.json`. It contains:

- Semesters
- Courses
- Marks
- Grade scale
- Previous semesters
- Export metadata and account information for account exports

### Delete local or account data

- In guest mode, **Clear local guest data** removes browser guest storage.
- In account mode, **Delete account** permanently removes the account and its database records.
- Deleting a semester removes the semester and all courses and marks below it.
- Deleting a course removes that course and all of its marks.

## Calculation rules

Calculation logic is implemented in [`src/shared/grade.ts`](./src/shared/grade.ts).

### Course component score

For assignment and quiz components:

1. Convert each entered mark to `obtained / maximum`.
2. Calculate the average of those ratios.
3. Multiply the average by the component weight.

For midterm and final components:

1. Use the first entered mark.
2. Divide obtained marks by maximum marks.
3. Multiply the ratio by the component weight.

Components without entered marks do not contribute to the partial score.

### Course percentage

For a course without a lab, the theory percentage is used directly.

For a course with both theory and lab components, the course percentage is:

```text
(theory percentage × theory credits + lab percentage × lab credits) / total course credits
```

If only one part has entered marks, that part's percentage is used provisionally.

A result is marked provisional until every weighted component in the available theory/lab parts is complete.

### SGPA

SGPA is the credit-weighted average of the course grade points in the selected semester:

```text
sum(course grade point × course credits) / sum(course credits)
```

Courses with zero credits do not contribute to SGPA.

### CGPA

CGPA includes:

- Previous-semester credit and SGPA totals
- Graded courses from the semesters on the current dashboard

The result is:

```text
sum(grade point × course credits) / sum(course credits)
```

The final number is rounded to two decimal places for display.

## Default grade scale

| Minimum percentage | Grade point | Letter |
|---:|---:|:---|
| 85 | 4.00 | A |
| 80 | 3.66 | A- |
| 75 | 3.33 | B+ |
| 71 | 3.00 | B |
| 68 | 2.66 | B- |
| 64 | 2.33 | C+ |
| 61 | 2.00 | C |
| 58 | 1.67 | C- |
| 54 | 1.33 | D+ |
| 50 | 1.00 | D |
| 0 | 0.00 | F |

The grade scale can be changed in the Profile or Settings page. The table is used for course grade points and is stored with the account or guest data.

## Data storage

### Guest mode

Guest records are stored in browser `localStorage` under:

```text
gpa_calc_guest_v1
```

Guest data can be lost if browser storage is cleared or if the browser profile is removed.

### Account mode

Account data is stored in Cloudflare D1. The database tables include:

- `users`
- `sessions`
- `otp_codes`
- `messages`
- `semesters`
- `courses`
- `marks`
- `grade_scale`
- `previous_semesters`

Browser caches use:

- `gpa_calc_auth_user_v1` for cached authentication state
- `gpa_calc_user_<userId>` for cached account data
- `gpa_calc_queue_<userId>` for pending account operations

The offline queue retries network failures and server errors. Invalid `4xx` operations are removed from the queue to prevent a permanently blocked sync.

## Project structure

```text
src/
├── shared/
│   ├── grade.ts           Grade and GPA calculations
│   ├── rollValidation.ts  Roll formatting and validation
│   └── types.ts           Shared data types and defaults
├── web/
│   ├── components/        Reusable dashboard components
│   ├── hooks/useData.ts   Browser storage and cloud synchronization
│   ├── lib/storage.ts     Legacy/local browser storage helpers
│   └── pages/             Dashboard, authentication, and profile pages
└── worker/
    └── index.ts           Cloudflare Worker API and D1 access
migrations/
└── 0001_init.sql          Initial D1 schema
```

## Build

Create a production build:

```bash
npm run build
```

The build runs TypeScript checks and writes the Vite application to `dist/`.

Preview the build locally:

```bash
npm run preview
```

## Cloudflare deployment

The project is configured in [`wrangler.jsonc`](./wrangler.jsonc).

Before deployment:

1. Create or select a Cloudflare D1 database.
2. Set the database ID in `wrangler.jsonc`.
3. Apply the database migration.
4. Configure the required Worker secrets and public environment variables.

Set the public Turnstile site key for Vite:

```bash
cp .env.example .env
```

Set the Worker secrets:

```bash
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put BREVO_SENDER_EMAIL
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Set the optional Formspree endpoint:

```bash
npx wrangler secret put FORMSPREE_URL
```

Keep server-side secrets in Wrangler Secret bindings. The public `VITE_TURNSTILE_SITE_KEY` value is not a secret.

Apply the migration locally:

```bash
npx wrangler d1 migrations apply gpa-db --local
```

Apply the migration to the remote database:

```bash
npx wrangler d1 migrations apply gpa-db --remote
```

Build and deploy:

```bash
npm run build
npx wrangler deploy
```

The Worker serves both the API routes and the built Vite single-page application.

## Database maintenance

Use the Wrangler D1 commands to inspect or modify the remote database.

List the configured databases:

```bash
npx wrangler d1 list
```

Execute a read-only query:

```bash
npx wrangler d1 execute gpa-db --remote --command "SELECT COUNT(*) AS users FROM users;"
```

Before running update or delete statements, confirm the exact roll number or user ID. Direct database changes should be treated as account data operations and performed with care.

## Recommendations

Before public deployment, configure and verify the following:

- Run `npm run build` and test authentication, guest sync, offline sync, account deletion, and export flows.
- Apply migrations before starting the deployed Worker.
- Keep the database ID and deployment configuration in version control only if it is not sensitive for the target project setup.
- Back up the D1 database before migrations or account maintenance.
- Test the application on mobile, tablet, and desktop widths.
- Verify the roll-number format used by the target institution.
- Verify that the default grading scale and theory/lab credit rules match the institution's policy.
- Use HTTPS for every public deployment.
- Keep passwords secure and avoid using the same password across separate services.
- If account security becomes a concern later, add stronger password requirements, login throttling, and session revocation after password changes.

## Security

See [SECURITY.md](./SECURITY.md) for supported versions and vulnerability reporting instructions.

## Technology

- React 19
- React Router 7
- TypeScript
- Vite 6
- Tailwind CSS 4
- Hono
- Zod
- Cloudflare Workers
- Cloudflare D1
- Web Crypto PBKDF2
