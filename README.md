# Westlake Coffee — site + dashboard

Static site plus a password-protected content dashboard. The owners log in at `/admin`, edit content in a friendly form, and the site updates automatically.

## Local preview

```bash
cd ~/westlake-diner
python3 -m http.server 4321
# open http://localhost:4321
```

The `/admin` dashboard only fully works on the deployed Netlify site (it relies on Netlify Identity for login). Locally you can preview the editing UI by uncommenting `local_backend: true` in `admin/config.yml` and running `npx decap-server` in another tab.

## Going live (one-time)

1. Push this folder to a new GitHub repo
2. Sign up at netlify.com (free)
3. "Add new site" → "Import from GitHub" → pick the repo → Deploy
4. Site Settings → Identity → Enable Identity
5. Identity → Registration: **Invite only**
6. Identity → Services → **Enable Git Gateway**
7. Identity → Invite users → enter the owner's email — they get an invite link, set a password, and they're in

## Custom domain

In Netlify → Domain Settings → Add custom domain → `westlakecoffee.com`. Netlify shows you the two DNS records to set. Free SSL is automatic.

## Cost

- Hosting: **$0/month** on Netlify free tier (more than enough for a restaurant site)
- Domain: whatever they already pay (~$12–15/year)
- Identity (dashboard logins): **free** up to 5 users
