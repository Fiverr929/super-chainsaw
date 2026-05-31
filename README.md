# Workstation V2

A high-performance grid interface designed for aggressive e-commerce asset generation. 

It takes minimal input data and forcefully expands it into fully optimized titles, descriptions, and taxonomy parameters using an automated generation pipeline, then pushes the resulting assets directly to the target marketplace.

## Architecture

- Automated Generation: Point the vertex integration at a base prompt and watch it hallucinate missing SEO attributes, 140-character titles, and optimized alt text.
- Spreadsheet Grid: Built on glide-data-grid to handle hundreds of rows of raw product data being edited synchronously.
- Digital Asset Pipeline: Handles packaging, zipping, and uploading digital artifacts alongside their listing metadata.

## Local Development

If you're bold enough to run this locally, follow these steps. 

1. Install dependencies
```bash
npm install
```

2. Configure environment variables in `.env.local`
```bash
GOOGLE_API_KEY=your_key_here
# Add marketplace keys as needed
```

3. Spin up the dev server
```bash
npm run dev
```

Navigate to `http://localhost:3000` to interact with the grid.

## Notes

- Keep the `public/listings` folder out of your git history if you are working with live commercial assets.
- Do not commit your `.env.local` file. The repository has protections in place, but don't test them.
