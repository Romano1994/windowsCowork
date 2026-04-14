# Build and Deployment Guide

This guide explains how to build and package the Windows Cowork application for distribution.

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- Windows OS (for Windows builds)

## Build Commands

### Development Mode

Run the application in development mode with hot reload:

```bash
npm start
```

### Package Application

Create a packaged application without an installer (portable version):

```bash
npm run package
```

Output: `out/windows-cowork-win32-x64/`

### Create Installer

Create a Windows installer with Squirrel:

```bash
npm run make
```

Output: `out/make/squirrel.windows/x64/`

### Platform-Specific Build

Build for a specific platform:

```bash
npm run make -- --platform=win32
npm run make -- --platform=darwin
npm run make -- --platform=linux
```

## Build Output

After running `npm run make`, you'll find the following in `out/make/squirrel.windows/x64/`:

1. **Windows Cowork-1.0.0 Setup.exe** - The installer users will run
2. **RELEASES** - Metadata file for Squirrel auto-updater
3. **windows-cowork-1.0.0-full.nupkg** - Full application package

### Distribution Files

**For end users:**
- Distribute: `Windows Cowork-1.0.0 Setup.exe`
- Users double-click to install
- Installs to: `C:\Users\<username>\AppData\Local\windows_cowork\`
- Creates Start Menu shortcut

**For portable version:**
- Distribute: `out/windows-cowork-win32-x64/` folder (zipped)
- Users extract and run `Windows Cowork.exe` directly
- No installation required

## Installation Testing

1. Build the installer:
   ```bash
   npm run make
   ```

2. Locate the installer:
   ```bash
   cd out/make/squirrel.windows/x64/
   dir
   ```

3. Run the installer:
   - Double-click `Windows Cowork-1.0.0 Setup.exe`
   - Installation happens automatically (no UI)
   - Takes ~10-30 seconds

4. Launch the application:
   - Search "Windows Cowork" in Start Menu
   - Or run from: `%LOCALAPPDATA%\windows_cowork\Windows Cowork.exe`

5. Verify functionality:
   - Test terminal creation
   - Test multi-session support
   - Test AI integration
   - Check for any errors in DevTools (Ctrl+Shift+I)

## Uninstallation

Users can uninstall via:
- Windows Settings → Apps → Windows Cowork → Uninstall
- Control Panel → Programs and Features

## Build Troubleshooting

### Build Fails

**Error: "Cannot find module 'node-pty'"**
- Solution: `npm install` to ensure all dependencies are installed

**Error: Python/Visual Studio Build Tools required**
- This shouldn't happen as we're using prebuilt node-pty binaries
- If it occurs, check `rebuildConfig.onlyModules: []` in `forge.config.ts`

### Installer Issues

**Windows Defender SmartScreen Warning**
- This is normal for unsigned applications
- Users can click "More info" → "Run anyway"
- To avoid: Purchase a code signing certificate (~$100-400/year)

**Installer doesn't create Start Menu shortcut**
- Check Squirrel logs: `%LOCALAPPDATA%\SquirrelTemp\`
- Verify `name` in MakerSquirrel config uses underscores, not spaces

### Icon Not Showing

**Default Electron icon appears**
- Ensure icon files exist in `assets/` folder
- Uncomment icon settings in `forge.config.ts`
- Rebuild: `npm run make`

## Code Signing (Optional)

To eliminate SmartScreen warnings, sign your application:

1. Purchase a code signing certificate from:
   - Sectigo
   - DigiCert
   - SSL.com

2. Install the certificate on your build machine

3. Update `forge.config.ts`:
   ```typescript
   packagerConfig: {
     asar: true,
     executableName: 'Windows Cowork',
     icon: './assets/icon',
     win32metadata: {
       CompanyName: 'romano1994',
       FileDescription: 'AI-Powered Development Tool',
       ProductName: 'Windows Cowork',
     },
   }
   ```

4. Use Electron Forge's signing plugin or external tools like SignTool

## Auto-Updates (Optional)

Squirrel.Windows supports auto-updates. To enable:

1. Host update files on a server (GitHub Releases, S3, etc.)
2. Add update server URL to MakerSquirrel config
3. Implement update checking in your main process

See: [Squirrel.Windows documentation](https://github.com/Squirrel/Squirrel.Windows)

## Multi-Platform Builds

### macOS (.app, .dmg)

On macOS, run:
```bash
npm run make
```

Output: `out/make/zip/darwin/x64/windows-cowork-darwin-x64-1.0.0.zip`

### Linux (.deb, .rpm)

On Linux, run:
```bash
npm run make
```

Outputs:
- `out/make/deb/x64/windows-cowork_1.0.0_amd64.deb`
- `out/make/rpm/x64/windows-cowork-1.0.0-1.x86_64.rpm`

## CI/CD Integration

For automated builds (GitHub Actions, etc.):

```yaml
- name: Install dependencies
  run: npm install

- name: Build application
  run: npm run make

- name: Upload artifacts
  uses: actions/upload-artifact@v3
  with:
    name: windows-installer
    path: out/make/squirrel.windows/x64/*.exe
```

## Version Bumping

Before releasing a new version:

1. Update `version` in `package.json`:
   ```json
   "version": "1.1.0"
   ```

2. Rebuild:
   ```bash
   npm run make
   ```

3. Installer will be named: `Windows Cowork-1.1.0 Setup.exe`

## Support and Issues

- Check logs: `%APPDATA%\windows-cowork\logs\`
- DevTools: Press Ctrl+Shift+I in the app
- Squirrel logs: `%LOCALAPPDATA%\SquirrelTemp\`

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Packager](https://github.com/electron/electron-packager)
- [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows)
- [Electron Builder (alternative)](https://www.electron.build/)
