export type ExampleDesign = {
  id: string;
  name: { de: string; en: string };
  description: { de: string; en: string };
  svg: string;
};

export const EXAMPLE_DESIGNS: ExampleDesign[] = [
  {
    id: "cherries",
    name: { de: "Kirschduo", en: "Cherry duo" },
    description: { de: "Fruchtig & farbig", en: "Fruity & colorful" },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
      <path d="M58 45 C58 25 68 15 81 10" fill="none" stroke="#23633f" stroke-width="5"/>
      <path d="M61 45 C54 26 43 18 31 14" fill="none" stroke="#23633f" stroke-width="5"/>
      <path d="M70 19 C82 12 94 14 100 24 C87 29 77 27 70 19 Z" fill="#4f9b4b"/>
      <circle cx="43" cy="65" r="23" fill="#d83939"/>
      <circle cx="77" cy="66" r="23" fill="#ef4b45"/>
      <circle cx="35" cy="57" r="5" fill="#ff8b78"/>
      <circle cx="69" cy="58" r="5" fill="#ff9d8e"/>
    </svg>`,
  },
  {
    id: "cat",
    name: { de: "Mondkatze", en: "Moon cat" },
    description: { de: "Miau im Sternlicht", en: "Meow in starlight" },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
      <circle cx="79" cy="35" r="25" fill="#f2be4b"/>
      <circle cx="89" cy="27" r="25" fill="#fff7e7"/>
      <path d="M31 52 L34 27 L47 39 L62 28 L64 53 C76 60 81 77 76 91 L30 91 C25 76 24 63 31 52 Z" fill="#303746"/>
      <path d="M73 83 C101 80 100 55 87 54 C80 53 78 61 84 65" fill="none" stroke="#303746" stroke-width="8"/>
      <ellipse cx="44" cy="53" rx="3" ry="5" fill="#f2be4b"/>
      <ellipse cx="57" cy="53" rx="3" ry="5" fill="#f2be4b"/>
      <circle cx="95" cy="15" r="3" fill="#e55452"/>
      <circle cx="105" cy="43" r="2" fill="#e55452"/>
    </svg>`,
  },
  {
    id: "wildflowers",
    name: { de: "Wiesenfreude", en: "Meadow joy" },
    description: { de: "Kleiner Blütenstrauß", en: "Tiny flower bouquet" },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
      <path d="M59 91 C57 69 52 50 35 28 M60 91 C64 67 71 45 88 24 M59 91 C58 66 61 43 60 20" fill="none" stroke="#35724a" stroke-width="4"/>
      <ellipse cx="45" cy="60" rx="12" ry="5" transform="rotate(28 45 60)" fill="#5da960"/>
      <ellipse cx="75" cy="61" rx="12" ry="5" transform="rotate(-25 75 61)" fill="#5da960"/>
      <g fill="#ee6b7b"><circle cx="35" cy="19" r="10"/><circle cx="25" cy="29" r="10"/><circle cx="35" cy="39" r="10"/><circle cx="45" cy="29" r="10"/></g>
      <circle cx="35" cy="29" r="8" fill="#f5c64f"/>
      <g fill="#8b6bc5"><circle cx="60" cy="12" r="9"/><circle cx="51" cy="21" r="9"/><circle cx="60" cy="30" r="9"/><circle cx="69" cy="21" r="9"/></g>
      <circle cx="60" cy="21" r="7" fill="#f5c64f"/>
      <g fill="#f08b46"><circle cx="88" cy="15" r="9"/><circle cx="79" cy="24" r="9"/><circle cx="88" cy="33" r="9"/><circle cx="97" cy="24" r="9"/></g>
      <circle cx="88" cy="24" r="7" fill="#633f32"/>
    </svg>`,
  },
  {
    id: "rocket",
    name: { de: "Kosmorakete", en: "Cosmic rocket" },
    description: { de: "Auf zu den Sternen", en: "Off to the stars" },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
      <path d="M60 9 C78 20 84 43 76 65 L44 65 C36 43 42 20 60 9 Z" fill="#eef0ee" stroke="#354353" stroke-width="3"/>
      <circle cx="60" cy="36" r="10" fill="#52a9ca" stroke="#354353" stroke-width="3"/>
      <path d="M44 51 L30 68 L46 67 Z M76 51 L90 68 L74 67 Z" fill="#e65342"/>
      <path d="M50 65 L55 91 L61 69 L67 91 L71 65 Z" fill="#f1b63e"/>
      <path d="M53 65 L59 84 L65 65 Z" fill="#ee6541"/>
      <circle cx="23" cy="26" r="4" fill="#f1b63e"/>
      <circle cx="95" cy="20" r="5" fill="#8b6bc5"/>
      <circle cx="101" cy="44" r="3" fill="#f1b63e"/>
    </svg>`,
  },
];
