import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as path from 'path';
import * as fs from 'fs';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,  // Disable ASAR to ensure node-pty works correctly
    executableName: 'FreiCowork',
    // icon: './assets/icon', // Uncomment when icon files are added
    afterCopy: [
      (buildPath, electronVersion, platform, arch, callback) => {
        // Copy node-pty to the build directory
        const src = path.join(process.cwd(), 'node_modules', 'node-pty');
        const dest = path.join(buildPath, 'node_modules', 'node-pty');

        console.log(`Copying node-pty from ${src} to ${dest}`);

        const copyDir = (srcDir: string, destDir: string) => {
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const entries = fs.readdirSync(srcDir, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        try {
          copyDir(src, dest);
          console.log('node-pty copied successfully!');
          callback();
        } catch (error) {
          console.error('Error copying node-pty:', error);
          callback(error as Error);
        }
      },
    ],
  },
  rebuildConfig: {
    // node-pty ships N-API prebuilt binaries; skip native rebuild (requires Python + VS Build Tools)
    onlyModules: [],
  },
  makers: [
    new MakerSquirrel({
      name: 'freicowork',
      authors: 'romano1994',
      description: 'AI-Powered Development Tool',
      // icon: './assets/icon.ico', // Uncomment when icon file is added
      noMsi: true,  // Skip MSI creation - only create Setup.exe
      setupExe: 'FreiCowork-Setup.exe',
      loadingGif: undefined,  // Disable splash screen during update
    }),
    new MakerZIP({}, ['win32', 'darwin']),  // Portable version
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    // AutoUnpackNativesPlugin removed - not needed when asar is disabled
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
