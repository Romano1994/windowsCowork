# Assets Directory

This directory contains application icons and other visual assets.

## Adding Application Icons

To add custom icons to your Windows Cowork application:

### 1. Prepare Icon Files

**For Windows (.ico):**
- Size: 256x256 pixels or larger
- Format: .ico with multiple resolutions embedded (16, 32, 48, 64, 128, 256)
- Recommended tool: [ICO Convert](https://icoconvert.com/) or [Favicon.io](https://favicon.io/)

**For macOS (.icns):**
- Size: 512x512 or 1024x1024 pixels
- Format: .icns
- Recommended tool: [Icon Slate](https://www.kodlian.com/apps/icon-slate) or online converters

### 2. Add Icon Files

Place your icon files in this directory:
```
assets/
  ├── icon.ico    (Windows)
  └── icon.icns   (macOS)
```

### 3. Update Configuration

Edit `forge.config.ts` and uncomment the icon settings:

```typescript
packagerConfig: {
  asar: true,
  executableName: 'Windows Cowork',
  icon: './assets/icon', // Remove comment
}
```

And in the MakerSquirrel configuration:
```typescript
new MakerSquirrel({
  name: 'windows_cowork',
  authors: 'romano1994',
  description: 'AI-Powered Development Tool',
  setupIcon: './assets/icon.ico', // Remove comment
})
```

### 4. Rebuild the Application

Run the build command:
```bash
npm run make
```

### 5. Verify Icons

Check the following after installation:
- Taskbar icon
- Alt+Tab icon
- Installed programs list
- Desktop shortcut (if created)
- Start menu icon

## Icon Design Tips

- Use simple, recognizable shapes
- Ensure good contrast for small sizes
- Test on both light and dark backgrounds
- Keep design elements centered
- Avoid fine details that won't be visible at 16x16

## Online Icon Generators

If you need to create an icon quickly:
- [Favicon.io](https://favicon.io/favicon-generator/)
- [Canva](https://www.canva.com/create/icons/)
- [Figma](https://www.figma.com/) (free design tool)
- [Icon Kitchen](https://icon.kitchen/)

## Current Status

⚠️ **No icon files are currently present.** The application will use the default Electron icon until custom icons are added.

To add icons, follow the steps above and rebuild the application.
