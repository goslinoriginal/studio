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

## Updating the app

Change the files, then change `VERSION` in `sw.js` (for example from `studio-v1` to `studio-v2`) and upload again. Your data isn't affected.

## Backups

Go to **Settings → Download backup** now and then. **Restore backup** merges a backup file back in, and nothing you have now is lost. **Income & expenses (CSV)** opens in Excel or Google Sheets, which is handy at tax time.
