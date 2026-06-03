# Developer & AI Agent Guidelines

This document outlines key technical constraints, rules, and best practices for developer and AI agents maintaining this repository.

---

## 1. Directory Structure & File Organization
- **Do Not Leave Loose Scratch Files:** Development or exploratory scripts must be kept in a temporary scratch directory or outside the git-tracked folders. Unused files must be deleted immediately.
- **Ignore Local Logs:** Local runtime debug logs must be named `latest_error.json` (or matching patterns in `.gitignore`) and must **never** be checked into version control.

## 2. API Conventions & Environment Variables
- **Never Hardcode System Paths:** Always use `process.cwd()` and `path.join` for reading/writing local files. Machine-specific paths (like `C:\Users\...`) are prohibited as they break cross-platform compatibility.
- **API Response Handlers:**
  - Route files under `src/app/api/assets/` and `src/app/api/local/scan/` must specify `export const dynamic = 'force-dynamic'` to prevent Vercel or Next.js from aggressively caching static pages.
  - Failures in the Etsy API pipeline must be gracefully logged to `latest_error.json` while throwing descriptive messages back to the UI.

## 3. Spreadsheet (Glide Data Grid) Guidelines
- **Sync State Debounce:** Local storage synchronization for grid modifications is debounced by `500ms`. Do not bypass this as it leads to browser storage congestion.
- **Custom Cell Renderers:** The grid uses custom dropdown cell definitions. When adding new metadata attributes, register the option array inside `src/lib/etsyConstants.ts` first, and use custom cells for dropdown validation.
- **Hooks & Refs Separation:** Use `dataRef` to access the latest state within callbacks and queue tasks, ensuring React state triggers re-renders while asynchronous pipelines don't experience stale state closures.

## 4. Etsy Compliance Policies (AI Copywriting)
- **Title Length Limit:** Etsy titles are strictly capped at `140` characters. The AI generator should truncate and refine titles appropriately.
- **Acronym Formatting:** Etsy rejects listings with titles containing more than 3 fully capitalized terms. The backend enforces a failsafe that converts excess acronyms (e.g., SVG, PNG, DTG) into title-case (e.g., Svg, Png, Dtg). Keep this failsafe intact in the generation route.
- **Digital File Limit:** Max 5 files per listing.
- **Image Count Limit:** Max 10 images per listing.
