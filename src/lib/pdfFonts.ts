import { Font } from '@react-pdf/renderer';

// Register Roboto font family with full UTF-8 support
// This ensures accented characters (Portuguese) render correctly on all devices
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 'bold',
      fontStyle: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf',
      fontWeight: 'normal',
      fontStyle: 'italic',
    },
  ],
});

// Disable hyphenation to avoid breaking Portuguese words incorrectly
Font.registerHyphenationCallback(word => [word]);

export const PDF_FONT = 'Roboto';
export const PDF_FONT_BOLD = 'Roboto';
