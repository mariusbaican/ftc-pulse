# Running FTC Pulse Wirelessly (Different Network / No USB)

Because the FTC Pulse mobile app connects to **two** services on your Mac — the **Expo Metro Bundler** (port `8081`) and the **Flask Backend API** (port `5050`) — running it on your phone without USB and on a different network (e.g., mobile data or isolated Wi-Fi) requires tunneling both ports over HTTPS.

> **Prerequisite:** The `ftc-pulse` Android dev-client APK must already be installed on your phone (via `npx expo run:android`).

---

## Step 1: Start the Flask Backend

From the repository root (`/Users/mariusbaican/Uni/EIM/ftc-pulse`):

```bash
server/.venv/bin/python server/app.py
```

Verify it is listening on port `5050`.

---

## Step 2: Expose Flask via `ngrok`

In a **second terminal**, open an HTTPS tunnel to port `5050` (`ngrok` is installed at `/opt/homebrew/bin/ngrok`):

```bash
ngrok http 5050
```

*(If you haven't authenticated `ngrok` on this Mac yet, run `ngrok config add-authtoken <YOUR_TOKEN>` once using your free token from [dashboard.ngrok.com](https://dashboard.ngrok.com).)*

Copy the **Forwarding** HTTPS URL shown in the `ngrok` terminal, for example:

```text
https://a1b2-c3d4.ngrok-free.app
```

---

## Step 3: Start Expo Dev Client with `--tunnel` and `EXPO_PUBLIC_API_URL`

In a **third terminal**, navigate to `app/` and start Metro with `--tunnel`, passing your `ngrok` URL as `EXPO_PUBLIC_API_URL`:

```bash
cd app
EXPO_PUBLIC_API_URL=https://<your-ngrok-subdomain>.ngrok-free.app npx expo start --dev-client --tunnel
```

- If Expo prompts to install `@expo/ngrok`, press **`Y`** to allow it.
- Once the QR code appears, open the **ftc-pulse** app on your phone and scan the QR code (or paste the `exp+ftc-pulse://...` URL).

### How This Works
- **`--tunnel`** creates a public tunnel for Metro (`8081`) so your phone can download the JavaScript bundle and receive hot-reload updates from any network.
- **`EXPO_PUBLIC_API_URL`** overrides the default LAN/localhost detection in `src/services/api/client.ts` so every API call goes to your `ngrok` HTTPS URL and reaches Flask on port `5050`.

---

## Alternative: Standalone Build (No Metro Bundler Needed)

If you want to run the app on your phone **without keeping Metro (`expo start`) running**, you can build a standalone APK with the JS bundle embedded inside it:

1. Start Flask + `ngrok http 5050` (Steps 1 & 2 above) or deploy Flask to a public server.
2. Build a release APK with `EXPO_PUBLIC_API_URL` baked in:
   ```bash
   cd app/android
   EXPO_PUBLIC_API_URL=https://<your-ngrok-subdomain>.ngrok-free.app ./gradlew assembleRelease
   ```
   *(Or use EAS cloud builds: `bunx eas-cli build --platform android --profile preview`.)*
