# Khalid Almuteri — Personal Website

A lightweight, responsive personal website ready for **GitHub Pages** at **https://kalmuteri.github.io/**.

Built with plain HTML, CSS, and vanilla JavaScript. No Node.js build, third-party themes, runtime dependencies, API keys, or tracking scripts.

## Site structure

```text
kalmuteri.github.io/
├── index.html                         Home
├── about/index.html                   About
├── work/index.html                    Research interests + interactive wave simulation
├── writing/index.html                 Writing archive
├── writing/strategy-field-guide/      Your original nine-chapter field guide
├── writing/from-waves-to-computation/ A wave-equation explainer
├── writing/physics-and-ai/           An AI + physics essay
├── contact/index.html                 Contact / GitHub
├── assets/site.css                    Shared theme and responsive styles
├── assets/site.js                     Theme, menu and wavefield simulation
├── assets/favicon.svg                 Site icon
├── .nojekyll                          Publish files unmodified
├── sitemap.xml                        Search engine URLs
└── robots.txt                         Search engine directives
```

The **From Purpose to Progress** guide is an interactive HTML page with shared theme and navigation assets. Its header includes a return link to Writing. Chapter navigation supports browser history, and its tabs support arrow keys, Home, and End. Exercises, diagrams, and the print feature remain available.

## Publish at `https://kalmuteri.github.io/`

1. Create a GitHub repository named exactly **`kalmuteri.github.io`** under the `kalmuteri` GitHub account. If that repository already exists, use it rather than creating another.
2. Upload **the contents of this directory** (not the containing folder itself) to the repository root on the `main` branch.
3. Open **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, then choose **`main`** and **`/(root)`**. Save.
4. Visit **https://kalmuteri.github.io/** once GitHub finishes publishing.

Git option for a newly created empty repository:

```bash
git init
git add .
git commit -m "Launch personal website"
git branch -M main
git remote add origin https://github.com/kalmuteri/kalmuteri.github.io.git
git push -u origin main
```

If you clone an existing repository instead, copy the files into its checkout and commit/push there; do not rerun `git init` or re-add `origin`.

## Local preview

From the directory containing `index.html`:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Relative links also work in an ordinary static web host.

## Customize before publishing

- **Biography:** edit `index.html` and `about/index.html`. Verify biographical and educational descriptions reflect what you want public.
- **Work topics:** edit `work/index.html`. This page describes areas of interest rather than making claims about published or employer-owned projects.
- **Writing:** add an HTML folder under `writing/`, then add links from `writing/index.html` and anywhere else you want. Update `sitemap.xml`.
- **Contact:** the only contact link is currently your GitHub profile. Add a publicly shareable email/LinkedIn URL if desired; there is intentionally no invented contact information.
- **Theme:** edit CSS custom properties near the start of `assets/site.css`. Dark theme variables are under `body.dark`.
- **Shared navigation:** each HTML file contains its own static navigation to keep the site functional even without JavaScript.

The current drafts for the two additional technical essays are original starter content, written to make the site useful on launch. Please review and personalize them before treating them as your published professional opinions.

## Attribution and legal notes

- The strategy guide's content is sourced from the HTML file supplied for this project.
- The additional essays and website copy are drafts intended for owner review.
- Do not publish proprietary employer information, nonpublic datasets, or code without permission.
## UX and shared assets

- `assets/theme-init.js` applies the saved theme before the page is painted.
- `assets/ux.js` manages theme preferences and accessible mobile menus across all pages.
- `assets/ux.css` contains shared accessibility and responsive refinements.
- `assets/social-preview.png` is the 1200 × 630 sharing image; update its absolute URL in page metadata if the domain changes.

When updating navigation, verify the closed mobile menu is absent from the tab order, focus stays inside the open menu, Escape restores focus, and desktop resizing restores navigation. Check light/dark themes across the guide and site, guide browser Back/Forward and keyboard tabs, and wave controls while paused.
