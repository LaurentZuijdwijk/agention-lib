import { defineConfig } from "vitepress";

export default defineConfig({
  ignoreDeadLinks: [/^http:\/\/localhost/],
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
            { text: "Multimodal / Vision", link: "/guide/multimodal" },
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
          text: "Testing & Evaluation",
          items: [{ text: "Evaluation", link: "/guide/evals" }],
        },
        {
          text: "Resources",
          items: [
            { text: "Recipes", link: "/guide/recipes" },
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
