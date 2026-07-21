import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/noto-sans/latin-700.css";
import "@fontsource/noto-serif/latin-700.css";
import "@fontsource/pacifico/latin-400.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/playfair-display/latin-800.css";
import "@fontsource/lobster/latin-400.css";
import "@fontsource/bungee/latin-400.css";
import App from "./App";
import "./styles.css";
import "./v2.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
