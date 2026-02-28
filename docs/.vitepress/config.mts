import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Agention",
  description:
    "A modular TypeScript library for building AI agents and workflows",

  head: [
    [
      "script",
      {
        async: "",
        src: "https://www.googletagmanager.com/gtag/js?id=G-L248LRLBS9",
      },
    ],
    [
      "script",
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-L248LRLBS9');`,
    ],
  ],

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
            { text: "MCP", link: "/guide/mcp" },
            { text: "History Management", link: "/guide/history" },
            { text: "Context Management", link: "/guide/context-management" },
            { text: "Graph Pipelines", link: "/guide/graph-pipelines" },
          ],
        },
        {
          text: "RAG & Knowledge",
          items: [
            { text: "RAG Guide", link: "/guide/rag" },
            { text: "Embeddings", link: "/guide/embeddings" },
            { text: "Vector Stores", link: "/guide/vector-stores" },
            {
              text: "Chunking & Ingestion",
              link: "/guide/chunking-and-ingestion",
            },
          ],
        },
        {
          text: "Resources",
          items: [
            { text: "Examples", link: "/guide/examples" },
            { text: "FAQ", link: "/guide/faq" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [{ text: "Overview", link: "/api/" }],
        },
      ],
    },

    socialLinks: [],

    footer: {
      message: "Agention - AI Agents and Workflows",
    },
  },
});
