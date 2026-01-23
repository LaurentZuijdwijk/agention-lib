import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Agention",
  description:
    "A modular TypeScript library for building AI agents and workflows",

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API Reference", link: "/api/" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is Agention?", link: "/guide/getting-started" },
            { text: "Quickstart", link: "/guide/quickstart" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Agents", link: "/guide/agents" },
            { text: "Tools", link: "/guide/tools" },
            { text: "History Management", link: "/guide/history" },
            { text: "Graph Pipelines", link: "/guide/graph-pipelines" },
            { text: "Vector Stores", link: "/guide/vector-stores" },
          ],
        },
        {
          text: "Resources",
          items: [{ text: "Examples", link: "/guide/examples" }],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [{ text: "Overview", link: "/api/" }],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/laurentzuijdwijk/agention-lib",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
    },
  },
});
