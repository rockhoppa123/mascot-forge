// Ambient type for Vite's `?raw` import suffix (loads a file's contents as a string at build
// time). Not a new dependency — Vite already ships this loader; TS just needs to know the shape.
declare module "*?raw" {
  const content: string;
  export default content;
}
