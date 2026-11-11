# Farfield website

A one-page site for a company that builds solar farms, battery storage, data centers and robotic automation, and trains the technicians who run them.

It is plain HTML, CSS and JavaScript. There is no build step and nothing to install.

> **"Farfield" is a working title.** The name, the email address, the project figures and the Academy course lengths are placeholder content written to show the design. Replace them with your own before you publish. See [Make it yours](#make-it-yours).

## Preview it

Open `index.html` in a browser, or serve the folder so the address bar looks like a real site:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it online

Any static host works, because the site is just files.

- **Vercel or Netlify:** import this repository and accept the defaults. There is no build command and the output folder is the repository root.
- **GitHub Pages:** in the repository settings, open Pages and deploy from the branch root.

After the first deploy, change `og:image` in `index.html` to the full address of `assets/img/og.png` on your domain, so links shared on social media show the preview image.

## What is on the page

| Section | What it does |
| --- | --- |
| Hero | An animated site plan drawn in the browser: solar array, batteries, EV canopy, data hall, robotics cell and academy. Each label links to its section. The Day and Night switch changes the whole page theme and plays a short dusk or dawn on the drawing. |
| Energy | Solar and storage services, with a chart of 24 hours on a solar-plus-storage site. Hover or use the arrow keys to read values, or open the table. |
| Data centers | Services, an animated rack row, and typical rack power by cooling method. |
| Robotics | An interactive robot arm. It follows the pointer, grips on press, and runs its own pick-and-place cycle when left alone. |
| More technology | EV charging, microgrids, drones, digital twins and more. |
| Solar estimator | Sliders that turn a land area into capacity, yearly energy, homes supplied, CO₂ avoided and the data center load it could carry. |
| Academy | Technician training: the four-step path, six tracks in a tab panel, and who it is for. |
| How we work, Principles, Questions | Process, what "future-proof" means, and an FAQ. |
| Contact | A form with validation. See below for how to connect it. |

## Make it yours

**Name.** Search `index.html` for `Farfield` and replace it. The logo mark is the small `<svg class="brand__mark">` in the header and footer, and `assets/img/favicon.svg` is the browser tab icon.

**Email address.** Search `index.html` for `hello@farfield.example`. It appears in the contact section and on the `<form>` tag.

**Words and numbers.** All copy is in `index.html`. The two spec plates ("Typical project", "Typical hall"), the cooling ranges and the Academy course lengths are examples, so check each one against what you really offer.

**Colors and type.** Every color is a variable at the top of `assets/css/styles.css`, once for day and twice for night (one block follows the device setting, one follows the switch). Keep the two night blocks identical. The typeface is Archivo, loaded from Google Fonts in `index.html`.

**The site plan.** The drawing lives in `assets/js/campus.js`. Building positions are plain numbers near the middle of the file (`HALL`, `ACAD`, `TREES`, `ZONES` and so on), and its day and night colors are the `DAY` and `NIGHT` lists near the top.

**Estimator assumptions.** They are named constants at the top of the estimator block in `assets/js/site.js`: 2 hectares per MWp, 4,000 kWh per home per year, 0.45 tonnes of CO₂ per MWh, a PUE of 1.2 and 90% battery efficiency. Change them to match your market, and update the sentence under the results in `index.html` to say the same thing.

## Connect the contact form

A static site cannot send email by itself. Until you connect a form service, the form says so plainly and gives the visitor a ready-to-copy message addressed to you.

To make it send:

1. Create a form endpoint with a service such as Formspree, Basin or Getform, or write your own API route.
2. Put its address in `data-endpoint` on the `<form id="contact-form">` tag in `index.html`.

The form then posts the fields as JSON and shows "Message sent" only when the service confirms it.

## Files

```
index.html               All content
assets/css/styles.css    All styles, with day and night themes
assets/js/site.js        Theme switch, menu, scroll reveals, tabs, estimator, contact form
assets/js/charts.js      The 24-hour chart and the rack row
assets/js/campus.js      The animated site plan in the hero
assets/js/arm.js         The interactive robot arm
assets/img/              Favicon and social preview image
```

## Built in

- Works on phones, tablets and desktops, down to 320 px wide.
- Day and night themes that follow the visitor's device setting or the switch.
- Keyboard access throughout, visible focus states, and a table behind the chart.
- Animations stop for visitors who ask their device to reduce motion, and pause when off screen.
- The page still reads correctly with JavaScript turned off.
