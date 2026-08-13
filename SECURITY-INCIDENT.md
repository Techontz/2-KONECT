# Security Incident — direct2kariakoo.com

**Status:** Active compromise. The malicious code is still present in the copy of production you supplied, and its own log shows it running as recently as **24 June 2026**.
**Discovered:** 13 August 2026, during the Phase 0–2 inspection of `DOCS/public_html`.
**Assessed by:** static analysis of the downloaded production tree + the restored database. No live server access was used.

---

## 1. What is on the server

A **cloaked redirect doorway** — the server is being used as a disposable hop in someone else's phishing/scam funnel.

The payload lives at `public_html/en/index.php` (5,629 bytes, planted 2026-05-15). What it does, in order:

1. **Forces a JavaScript check.** No JS, no cookie → the visitor never sees the payload. This defeats `curl`, security scanners and most crawlers.
2. **Blocks bots by user-agent** — 60+ patterns including `googlebot`, `ahrefs`, `semrush`, `python`, `curl`, `puppeteer`.
3. **Blocks security researchers by ISP.** Calls `ip-api.com` for each visitor and drops anyone whose ISP matches 80+ keywords — `amazon`, `cloudflare`, `google`, every major VPN, every commercial scraping service.
4. **Allows one country only: Canada.** Everyone else is bounced to a random legitimate site (google.com, youtube.com…) so the page looks innocent to you, to me, and to anyone in Tanzania.
5. **Redirects the survivors** to `https://erschecaoneseros.com/p8Rt5Km/start/` with a 400-character tracking code — an affiliate/victim identifier, which means the operator is being **paid per redirect**.

The code contains a Romanian comment (`Versiunea GRATUITĂ fără cheie API`), suggesting a Romanian-speaking operator or toolkit.

### Confirmed impact

`public_html/en/logs21.txt` is the attacker's own log. It is not ambiguous:

| Outcome | Count |
|---|---|
| **`[ALLOWED]` — real people redirected to the scam** | **86** |
| `[BLOCKED ISP]` — scanners/researchers deflected | 19 |
| `[BLOCKED COUNTRY]` | 1 |

Active **2026-05-15 20:24** → **2026-06-24 02:27**. The victims are ordinary Canadian consumers on Cogeco, Rogers, Bell and Start Communications, on iPhones, Macs and Windows PCs. Real IPs are recorded in that log.

Because the cloaker only fires for Canadian visitors, **the site looks completely normal from Tanzania** — which is why this ran for six weeks unnoticed.

### Supporting artefacts

| Type | Count | Purpose |
|---|---|---|
| Zero-byte `*/index.php` in 5-hex-char directories (`0195e/`, `f7e89/`…) | 45 | Doorway placeholders / spam landing slots |
| Zero-byte `<hash>.php`, `<hash>index.php`, `<hash>.txt` in the web root | 23 | Upload probes and staging droppers |
| `adman.NNN.txt` (5–6 bytes each) | 16 | Toolkit beacons — confirm write access to the doc root |
| `wpconf.php` | 1 | WordPress-flavoured name → mass-scanner kit, not targeted at you |
| `php.ini` | 1 | Attacker-planted: `safe_mode=off`, `disable_functions=` — an attempt to unlock `exec`/`system` |

**Full list: 94 paths, in `security/malicious-files.txt`.**

Many are now zero bytes. That is consistent with the host's malware scanner having *truncated* them rather than removed them — a partial cleanup that left the directory structure and the live `en/index.php` intact.

---

## 2. How they most likely got in

**The attacker wrote files outside the web root.** Two droppers landed in the Laravel application directory, which is a sibling of `public_html`, not below it:

- `laravel/public/00f921d40765.php`
- `laravel/assets/images/accesson.php` (the entire `laravel/assets/` directory is attacker-created — it is not part of Laravel)

A PHP file-upload bug in the app could not normally reach there. Combined with the toolkit signatures (`wpconf.php`, `adman.*`), the probable vector is **stolen FTP / SFTP / DirectAdmin control-panel credentials**, or a compromise of a neighbouring site on the same hosting account — not a flaw in your Laravel code.

### Two conditions that made it easy

**a) ModSecurity is switched off.** `public_html/.htaccess` (lines 31–38) contains:

```apache
<IfModule mod_security2.c>
    SecRuleEngine Off
</IfModule>
```

This disables the host's web application firewall for the entire site. The file's timestamp (2025-10-25) and comment style match your own edits, so this appears to be a deliberate earlier change — most likely to stop ModSecurity rejecting product-image uploads. It removed the one layer that would most likely have caught this.

**b) Anything written into `storage/` executes.** The rewrite rules serve any existing file directly before handing off to Laravel, so a `.php` file inside the public storage tree would be executed by PHP rather than served as an upload. A zero-byte `00f921d40765.php` was already sitting in `public_html/storage/` — the attacker found that path.

### What is *not* compromised

I checked these specifically, and they are clean:

- **Laravel application code** — no `eval`, `base64_decode`, `gzinflate`, `preg_replace /e`, or superglobal execution anywhere in `app/`, `routes/`, `config/`, `bootstrap/`. Every modified file in `git status` is your own feature work.
- **All 5,307 uploaded media files** — every one is a genuine JPEG/PNG/WebP by content inspection. No PHP disguised as an image. Your product catalogue is intact.
- **The database** — one admin account only (`direct2kariakoo@gmail.com`, created 2025-09-27, before the attack). No injected admin, no suspicious user. The 247 users are ordinary customers.

---

## 3. What to do

Ordered by urgency. Steps 1–3 are the ones that matter today.

### Step 1 — Remove the payload (immediate)

The single file causing real-world harm is `public_html/en/index.php`. Deleting the `en/` directory stops the redirects instantly.

Then remove all 94 paths. `security/clean-production.sh` does this safely: it **backs every file up first**, prints what it will touch, and requires you to pass `--delete` before it removes anything. Run it on the server:

```bash
cd ~/public_html
bash clean-production.sh          # dry run — lists what would go
bash clean-production.sh --delete # performs the removal, after backing up
```

Keep `en/logs21.txt`. It is evidence, and it identifies the 86 people who were redirected.

### Step 2 — Rotate every credential (assume all are known to the attacker)

They had filesystem read access across the account, and `laravel/.env` is readable from there. Treat all of these as leaked:

| Credential | Where | Action |
|---|---|---|
| DirectAdmin / cPanel password | Host control panel | Change now |
| FTP / SFTP accounts | Host control panel | Change now; delete any account you don't recognise |
| SSH keys | `~/.ssh/authorized_keys` | Audit and replace |
| `DB_PASSWORD` | `laravel/.env` | Change in MySQL, then in `.env` |
| `APP_KEY` | `laravel/.env` | See caution below |
| AzamPay `CLIENT_SECRET`, `X_API_KEY` | `laravel/.env` | **Rotate with AzamPay — these are payment credentials** |
| Pusher `APP_SECRET` | `laravel/.env` | Rotate in the Pusher dashboard |
| Admin account password | `direct2kariakoo@gmail.com` | Change; enable 2FA if available |

> **Caution on `APP_KEY`:** changing it invalidates every existing session and any encrypted column. Change it during a maintenance window and expect all users to be logged out.

Also revoke the **1,506 outstanding API tokens** — none has ever been revoked, and they are bearer tokens:

```sql
DELETE FROM personal_access_tokens;   -- forces every app user to log in again
DELETE FROM sessions;
```

### Step 3 — Close the two open doors

**Re-enable ModSecurity.** Remove the `SecRuleEngine Off` block from `public_html/.htaccess`. If it then blocks legitimate image uploads, ask your host to whitelist the specific rule ID rather than disabling the whole engine.

**Stop PHP executing inside the upload tree.** Add to `public_html/storage/.htaccess`:

```apache
<FilesMatch "\.(php|phtml|php3|php4|php5|php7|php8|pl|py|cgi|sh)$">
    Require all denied
</FilesMatch>
php_flag engine off
```

**Delete `public_html/clear.php`.** This is your own file, not the attacker's, but it lets anyone on the internet flush your entire application cache by loading a URL — an unauthenticated denial-of-service lever. It should not be public.

**Delete the attacker's `public_html/php.ini`.** It is included in the cleanup script.

### Step 4 — Follow-up

- **Ask your host for access logs** covering 2026-04-25 → today, and look for the POST that first created `en/index.php` on 2026-05-15. That pinpoints the vector.
- **Check for other sites on the same account.** `wpconf.php` implies a WordPress install was targeted; if one shares this hosting account, it is likely the original entry point.
- **Report the destination.** `erschecaoneseros.com` can be reported to Google Safe Browsing and the Canadian Anti-Fraud Centre. Your domain may already be flagged by association — worth checking at `transparencyreport.google.com/safe-browsing/search`.
- **Rebuild rather than clean, if you can.** Cleaning removes what I found. Only a rebuild from known-good code plus verified media guarantees nothing was left behind. Your catalogue and images are safe and fully reproduced locally, so a rebuild is realistic.

---

## 4. Effect on the website project

**None to the data.** The local development environment was built before this was found and is unaffected:

- `d2k_dev` database — restored from your dump, **2,857 products / 4,012 images / 14 vendors / 247 users / 98 orders**
- `d2k_backend/storage/app/public` — 1.1 GB of media, **4,096 of 4,096 database image references resolve to a real file**
- The two zero-byte droppers that came in with the download were quarantined to `_quarantine/`, not deleted

The website build can resume the moment you're ready.
