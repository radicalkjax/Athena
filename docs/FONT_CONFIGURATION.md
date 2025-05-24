# Font Configuration Guide

This document outlines the font configuration setup for the Athena application and provides troubleshooting guidance for common font-related issues.

## Overview

Athena uses a custom font configuration to ensure consistent typography across web and native platforms. The application primarily uses the Roboto font family with system font fallbacks.

## Font Configuration

### Custom Theme Implementation

The font configuration is implemented in `app/_layout.tsx` through custom theme objects that extend React Navigation's default themes:

```typescript
const CustomDefaultTheme = {
  ...DefaultTheme,
  fonts: {
    regular: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '400',
    },
    medium: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '500',
    },
    bold: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '700',
    },
    heavy: {
      fontFamily: Platform.select({
        web: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        default: 'System',
      }),
      fontWeight: '900',
    },
  },
};
```

### Font Assets

The application includes Roboto font files located in `assets/fonts/Roboto/`:
- `Roboto-Regular.ttf`
- `Roboto-Medium.ttf`
- `Roboto-Bold.ttf`
- `Roboto-Light.ttf`

### Web Font Loading

For web platforms, fonts are loaded through CSS using the `web/font-override.css` file:

```css
@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/Roboto/Roboto-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/Roboto/Roboto-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/Roboto/Roboto-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}

@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/Roboto/Roboto-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}
```

## Common Issues and Solutions

### ".regular property access error"

**Problem**: Error message "Cannot read properties of undefined (reading 'regular')" or similar for other font weights.

**Cause**: React Navigation components trying to access font properties from the theme's fonts object, but the properties are not properly defined.

**Solution**: Ensure all required font weight properties (regular, medium, bold, heavy) are defined in both CustomDefaultTheme and CustomDarkTheme objects in `app/_layout.tsx`.

### Font Loading Issues on Web

**Problem**: Fonts not displaying correctly on web platform.

**Cause**: Font files not properly loaded or CSS not applied.

**Solutions**:
1. Verify font files exist in `assets/fonts/Roboto/`
2. Check that `web/font-override.css` is properly configured
3. Ensure font paths in CSS are correct relative to the build output
4. Clear browser cache and rebuild the application

### Platform-Specific Font Issues

**Problem**: Fonts appearing differently on web vs native platforms.

**Cause**: Platform-specific font handling differences.

**Solution**: Use `Platform.select()` to provide appropriate font configurations for each platform:
- Web: Use web font stack with Roboto as primary
- Native: Use 'System' font for better native integration

## Best Practices

1. **Always define all font weights**: Ensure regular, medium, bold, and heavy are all defined to prevent undefined property errors.

2. **Use platform-specific configurations**: Leverage `Platform.select()` to provide optimal font configurations for each platform.

3. **Provide fallback fonts**: Include system font fallbacks in the web font stack for better compatibility.

4. **Test across platforms**: Verify font rendering on both web and native platforms during development.

5. **Keep font files organized**: Maintain font assets in a clear directory structure under `assets/fonts/`.

## Troubleshooting Steps

If you encounter font-related errors:

1. **Check console logs**: Look for specific error messages about missing font properties.

2. **Verify theme configuration**: Ensure custom themes are properly defined and applied in `app/_layout.tsx`.

3. **Restart development server**: Font configuration changes may require a server restart to take effect.

4. **Clear cache**: Clear browser cache and Metro bundler cache if fonts aren't loading properly.

5. **Check file paths**: Verify that font file paths in CSS and configuration are correct.

## File Locations

- **Main font configuration**: `app/_layout.tsx`
- **Web font CSS**: `web/font-override.css`
- **Font assets**: `assets/fonts/Roboto/`
- **Global styles**: `assets/global.css`

## Related Documentation

- [Getting Started Guide](GETTING_STARTED.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
