import type { Config } from "tailwindcss";

/** Present so tooling (e.g. shadcn CLI) detects Tailwind; v4 theme lives in `globals.css`. */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
} satisfies Config;
