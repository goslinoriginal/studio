# Studio

A business app for Mari & Damien's website business. You can keep clients, leads, jobs, reminders, quotes, invoices, payments and expenses in it. It installs on your phone or laptop like a normal app and works offline. Both of you see the same data.

## 1. Put it online (one time, free)

1. On github.com (the goslinoriginal account), create a new **public** repository called `studio`.
2. Upload these files to it: `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll` and the `icons` folder.
3. Go to **Settings → Pages**. Under "Branch" choose `main` and `/ (root)`, then click **Save**.
4. About a minute later the app is live at `https://goslinoriginal.github.io/studio/`.

## 2. Install it

- **iPhone:** open the link in **Safari**, tap Share, then **Add to Home Screen**.
- **Android:** open the link in **Chrome**, open the ⋮ menu, then tap **Install app**.
- **Laptop (Chrome or Edge):** click the install icon in the address bar.

## 3. Share it between the two of you

The app repository is public, so your business data goes in a separate **private** repository.

1. Create a new **private** repository called `studio-data`. Leave it empty.
2. Click your profile picture, then go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Name: `Studio`. Expiry: 1 year.
   - Repository access: **Only select repositories**, then pick `studio-data`.
   - Permissions: under Repository permissions, set **Contents** to **Read and write**.
   - Generate the token and copy it.
3. In the app go to **Settings (gear) → Share between your phones**, paste the token and tap **Connect**.
4. Tap **Copy invite link** and send it to your partner **privately**. They open it on their phone and pick their name, and that's it.

Every change is saved to `studio-data` as a commit, so GitHub also keeps a full history of your data. If both of you change something at the same moment, the app combines the two changes automatically.

The token expires after a year. When it does, the app shows "Sync problem". To fix it, make a new token the same way, tap **Unlink this device**, connect again and send a new invite link.

## 4. Notifications (optional, once)

Reminders can pop up on your phones even when Studio is closed. A small free Cloudflare Worker (`worker/worker.js`) checks your reminders every minute and sends them. The app walks you through it in **Settings → Notifications**:

1. Tap **Make notification key** and copy the private key it shows. It's only shown once.
2. On dash.cloudflare.com go to **Workers & Pages → Create → Worker**, name it `studio-reminders`, deploy, then **Edit code**. Paste the Worker code (the app has a **Copy Worker code** button) and deploy.
3. Under the Worker's **Settings → Variables and Secrets**, add two **Secrets**: `GITHUB_TOKEN` (the same access token the app uses; the app has a **Copy token** button) and `VAPID_PRIVATE_KEY` (the key from step 1).
4. Add a **Cron Trigger** that runs every minute (`* * * * *`).
5. Paste the Worker's link into the app and tap Save. Open the link in a browser to check it says `"ok": true`.
6. Each of you taps **Turn on** on your own phone. On iPhone this only works from the Home Screen app (iOS 16.4 or newer).

Reminders go to whoever they're for (or both of you). Ones without a time ping at 8am. On Android and computers the notification has **Snooze 1 hour** and **Done** buttons. On iPhone, tap it to open the reminder, where you can snooze for 15 min, 1 hour, 3 hours or until tomorrow.

## Updating the app

The app is built from the files in `source/`: change them, run `sh source/build.sh` to rebuild `index.html`, then change `VERSION` in `sw.js` (for example from `studio-v1` to `studio-v2`) and upload again. Your data isn't affected.

## Backups

Go to **Settings → Download backup** now and then. **Restore backup** merges a backup file back in, and nothing you have now is lost. **Income & expenses (CSV)** opens in Excel or Google Sheets, which is handy at tax time.
