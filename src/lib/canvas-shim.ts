// pdfjs conditionally loads the native `canvas` package only in Node rendering
// paths. The browser editor does not use that path, and Workers cannot load it.
export default {};
