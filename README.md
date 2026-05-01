# EZ FUEL — Marketing Website

A modern, conversion-focused marketing website for EZ FUEL fleet fuel cards and fleet tech support.

## Quick Start

No build step required. Open `index.html` in a browser or deploy the entire folder to any static host (Netlify, Vercel, Cloudflare Pages, S3, etc.).

```
ez-fuel-website/
├── index.html          # Home page
├── fuel-cards.html     # Fuel cards detail page
├── fleet-tech.html     # Fleet tech support page
├── pricing.html        # Pricing tiers + ROI calculator
├── network.html        # Accepted truck stop networks
├── about.html          # Company story & team
├── contact.html        # Application / contact form
├── assets/
│   ├── styles.css      # Custom styles (on top of Tailwind CDN)
│   ├── app.js          # Global UI: theme toggle, mobile nav, carousel, scroll reveal
│   └── calculator.js   # Savings calculator logic
└── README.md
```

## Tech Stack

- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`) — no build needed
- **Lucide Icons** via CDN (`unpkg.com/lucide`)
- **Inter** font from Google Fonts
- **Vanilla JS** — no framework dependencies

## Customization

### Brand Colors

Edit the Tailwind config in each HTML file's `<head>`:

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        pink: { 500: '#E83E8C', 600: '#D946EF' },  // Primary accent
        navy: { 900: '#0D1117', 800: '#161B22', 700: '#1F2328' },  // Backgrounds
        green: { 500: '#3FB950' },  // CTAs / savings
      }
    }
  }
}
```

Also update `assets/styles.css` CSS custom properties and gradient definitions.

### Savings Calculator

Edit `assets/calculator.js` to change discount tiers:

```js
const TIERS = [
  { min: 0,      max: 4999,     cpg: 30, label: "Starter" },
  { min: 5000,   max: 19999,    cpg: 45, label: "Growth" },
  { min: 20000,  max: 49999,    cpg: 60, label: "Pro" },
  { min: 50000,  max: Infinity, cpg: 80, label: "Enterprise" },
];
```

`cpg` = cents per gallon discount. The formula is: `gallons × cpg / 100 = monthly savings`.

### Apply Form

The form on `contact.html` uses `data-apply-form` and currently shows a client-side success message. To wire it to a real backend:

1. Add an `action` attribute to the `<form>` tag
2. Change the submit handler in `assets/app.js` (`bindApplyForm` function)
3. Or replace with your form provider (Formspree, Netlify Forms, etc.)

### Copy & Content

All copy is in the HTML files directly — search and replace. Key places:
- Hero headlines in each page's first `<section>`
- Stats in the stats row on `index.html`
- Testimonials in the carousel on `index.html`
- FAQ answers in `<details>` elements
- Footer contact info

### Dark / Light Mode

Dark mode is the default. The toggle persists to `localStorage`. To default to light mode, add `class="light"` to the `<html>` tag instead of `class="dark"`.

## Deployment

### Netlify / Vercel / Cloudflare Pages
Just point to this folder. No build command needed.

### Traditional Hosting
Upload all files preserving the folder structure. Ensure `assets/` is accessible.

### Custom Domain
Update any absolute references if needed (there are none by default — all paths are relative).

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge). Tailwind CDN requires ES6+.
