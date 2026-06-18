Vercel Deployment Guide
======================

This project is prepared for deployment to Vercel. Follow the steps below to push the current changes to a new branch and deploy.

1) Create a branch and push (example)

```bash
# create a branch locally
git checkout -b vercel-deploy-ready

# commit any local changes (already committed by the script if needed)
git add -A
git commit -m "chore: prepare vercel deployment - add DEPLOY.md and cleanup"

# push to your remote (origin)
git push -u origin vercel-deploy-ready
```

2) Add the GenAI API secret to Vercel

You must add a secret that matches the name referenced in `vercel.json`.

Via Vercel CLI:

```bash
vercel login
vercel secrets add genai_api_key "<YOUR_GENAI_API_KEY>"
```

Via Vercel Dashboard:

- Open your project in Vercel → Settings → Environment Variables / Secrets.
- Add a secret named `genai_api_key` (or create an Environment Variable and set value).

3) Deploy

After the branch is pushed, you can deploy from the Vercel dashboard by linking the repository and creating a new project, or deploy via CLI:

```bash
vercel --prod
```

Notes
- `vercel.json` already maps the env names:
  - `NEXT_PUBLIC_GENAI_API_KEY` -> `@genai_api_key`
  - `GENAI_API_KEY` -> `@genai_api_key`
  - `GEMINI_API_KEY` -> `@genai_api_key`
- If you prefer deploying from Git, push this branch and create a Pull Request; Vercel will build preview deployments automatically.

Troubleshooting
- If `npx vercel --prod` fails with an authentication error, run `vercel login` first.
- If you do not have a remote named `origin`, add it:

```bash
git remote add origin <git-repo-url>
git push -u origin vercel-deploy-ready
```

Questions?
- Tell me if you want me to create the branch, push it, or open a PR for you.
