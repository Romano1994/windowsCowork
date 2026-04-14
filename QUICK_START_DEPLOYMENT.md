# Quick Start - Deployment

> **TL;DR:** Your app is ready to distribute! Just share the installer file.

---

## 🚀 Your Installer is Ready

**Location:**
```
out/make/squirrel.windows/x64/Windows Cowork-1.0.0 Setup.exe
```

**Size:** 129 MB

---

## 📤 How to Distribute

1. **Upload the installer** to your preferred platform:
   - Google Drive / Dropbox
   - GitHub Releases
   - Your website
   - Direct email/USB

2. **Share with users** - They simply:
   - Download `Windows Cowork-1.0.0 Setup.exe`
   - Double-click to install
   - Launch from Start Menu

---

## 🔄 Rebuild Commands

```bash
# Make changes to code
# Then rebuild:
npm run make

# New installer will be in:
# out/make/squirrel.windows/x64/
```

---

## 🎨 Add Custom Icon (Optional)

**Quick Steps:**

1. Get icon files:
   - `assets/icon.ico` (256x256 or larger)
   - Tool: [favicon.io](https://favicon.io/favicon-generator/)

2. Edit `forge.config.ts` - Uncomment these lines:
   ```typescript
   icon: './assets/icon',           // Line 18
   setupIcon: './assets/icon.ico',  // Line 28
   ```

3. Rebuild:
   ```bash
   npm run make
   ```

---

## ⚠️ Windows Defender Warning

Users may see "Windows protected your PC" - this is normal for unsigned apps.

**Users click:**
1. "More info"
2. "Run anyway"

**To eliminate (optional):** Buy code signing certificate (~$200/year)

---

## 📚 Full Documentation

- **BUILD_GUIDE.md** - Complete deployment guide
- **DEPLOYMENT_STATUS.md** - Current build status
- **assets/README.md** - Icon setup details

---

## ✅ That's It!

Your Windows Cowork application is built and ready to share. 🎉
