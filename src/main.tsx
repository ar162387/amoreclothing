import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Self-hosted fonts (replaces the old render-blocking Google Fonts CSS @import) — only the weights
// actually used by the design system, see tailwind.config.ts's font-sans/font-serif mappings.
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";

import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
