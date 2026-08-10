import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { Tool } from "../lib/tools/Tool";
import { createInterface } from "node:readline/promises";
import { BaseAgent } from "../lib/agents/BaseAgent";
import { History } from "../lib/history/History";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// PubMed Search Tool
const pubmedSearchTool = new Tool({
  name: "pubmedSearch",
  description: `This tool searches PubMed for medical research articles based on search terms and returns metadata for relevant papers.
  It accepts search terms and additional parameters, and returns citation data for matching articles.`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search terms to use for finding medical literature. For best results, use specific medical terminology.",
      },
      maxResults: {
        type: "number",
        description:
          "Maximum number of results to return (default: 10, max: 20).",
      },
      sortBy: {
        type: "string",
        description:
          "How to sort results: 'relevance', 'date' (newest first), or 'cited' (most cited). Default is 'relevance'.",
      },
    },
    required: ["query", "maxResults", "sortBy"],
  },
  execute: async (input): Promise<any> => {
    try {
      // Set defaults and enforce limits
      const maxResults = Math.min(input.maxResults || 10, 20);
      const sortBy = input.sortBy || "relevance";

      // Use PubMed's E-utilities API
      // First, search for IDs matching the query
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(
        input.query
      )}&retmax=${maxResults}&sort=${
        sortBy === "date"
          ? "pub+date"
          : sortBy === "cited"
          ? "most+cited"
          : "relevance"
      }`;
      // console.log(searchUrl);
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (
        !searchData.esearchresult ||
        !searchData.esearchresult.idlist ||
        searchData.esearchresult.idlist.length === 0
      ) {
        return {
          count: 0,
          message: "No results found for your query.",
          articles: [],
        };
      }

      const ids = searchData.esearchresult.idlist;

      // Then, fetch summary data for these IDs
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(
        ","
      )}`;
      const summaryResponse = await fetch(summaryUrl);
      const summaryData = await summaryResponse.json();

      // Process and format results
      const articles = ids
        .map((id: string) => {
          const article = summaryData.result[id];
          if (!article) return null;

          return {
            pmid: id,
            title: article.title,
            authors: article.authors
              ? article.authors.map((a: any) => `${a.name}`)
              : ["No authors listed"],
            journal:
              article.fulljournalname || article.source || "Unknown journal",
            publicationDate: article.pubdate || "Unknown date",
            // abstract: article.abstract || "No abstract available",
            doi: article.elocationid
              ? article.elocationid.replace("doi: ", "")
              : null,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          };
        })
        .filter((a: any) => a !== null);
      // console.log({
      //   count: articles.length,
      //   query: input.query,
      //   articles,
      // });
      return {
        count: articles.length,
        query: input.query,
        articles,
      };
    } catch (error: any) {
      console.error("Error searching PubMed:", error);
      return {
        error: "Failed to search PubMed: " + error.message,
      };
    }
  },
});

// PubMed Abstract Fetcher Tool
const pubmedAbstractTool = new Tool({
  name: "pubmedGetAbstract",
  description: `This tool fetches the full abstract for a specific PubMed article by its ID (PMID).`,
  inputSchema: {
    type: "object",
    properties: {
      pmid: {
        type: "string",
        description:
          "PubMed ID (PMID) of the article to retrieve the abstract for.",
      },
    },
    required: ["pmid"],
  },
  execute: async (input): Promise<any> => {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${input.pmid}&retmode=json&rettype=abstract`;
      const response = await fetch(url);

      // PubMed efetch returns XML by default, so we'll manually extract the abstract
      const text = await response.text();
      // console.log({
      //   pmid: input.pmid,
      //   abstract: text,
      //   fullText: false, // PubMed doesn't provide full text, only abstracts
      //   url: `https://pubmed.ncbi.nlm.nih.gov/${input.pmid}/`,
      // });

      return {
        pmid: input.pmid,
        abstract: text,
        fullText: false, // PubMed doesn't provide full text, only abstracts
        url: `https://pubmed.ncbi.nlm.nih.gov/${input.pmid}/`,
      };
    } catch (error: any) {
      return {
        error: "Failed to retrieve abstract: " + error.message,
      };
    }
  },
});

const history = new History();

const medicalResearchAgent = new ClaudeAgent(
  {
    id: "medical-research",
    name: "Medical Research Assistant",
    description: `You are a medical research expert specializing in coming up with novel and in-depth knowledge based on literature research and extensive experience.

  You have access to PubMed, a database of medical research papers. Your goal is to help users:
  - Find relevant medical research for their questions
  - Summarize findings from medical literature
  - Explain medical concepts from research in clear, understandable terms
  - Identify patterns and consensus across multiple papers
  - Come up with novel strategies and thinking
  - Try to dive deep in the subject and cast a wide net
  - ALWAYS list sources

  When responding:
  1. Use the pubmedSearch tool to find relevant papers before providing any medical information
  2. ALWAYS cite your sources with PMID numbers and links
  3. Be clear about the strength of evidence (e.g., systematic review vs. single study)
  4. Highlight limitations of studies when appropriate

  You can use the pubmedGetAbstract tool to read full abstracts for the most relevant papers.`,
    tools: [pubmedSearchTool, pubmedAbstractTool],
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    // Using Opus for better medical knowledge and reasoning
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    temperature: 0.4,
  },
  history
);

// Alternative using OpenAI
const openAiMedicalAgent = new OpenAiAgent(
  {
    id: "openai-medical-research",
    name: "Medical Research Assistant",
    description: `You are a medical research expert specializing in coming up with novel and in-depth knowledge based on literature research and extensive experience.

  You have access to PubMed, a database of medical research papers. Your goal is to help users:
  - Find relevant medical research for their questions
  - Summarize findings from medical literature
  - Explain medical concepts from research in clear, understandable terms
  - Identify patterns and consensus across multiple papers
  - Come up with novel strategies and thinking
  - Try to dive deep in the subject and cast a wide net

  When responding:
  1. Use the pubmedSearch tool to find relevant papers before providing any medical information
  2. ALWAYS cite your sources with PMID numbers and links
  3. Be clear about the strength of evidence (e.g., systematic review vs. single study)
  4. Highlight limitations of studies when appropriate

  You can use the pubmedGetAbstract tool to read full abstracts for the most relevant papers.`,
    tools: [pubmedSearchTool, pubmedAbstractTool],
    apiKey: process.env.OPENAI_API_KEY as string,
    model: "gpt-4o",
  },
  history
);

async function runMedicalResearchExample() {
  try {
    let running = true;
    let agent: BaseAgent = medicalResearchAgent; // Default to Claude
    // pubmedSearchTool.on(ToolEvent.EXECUTE, console.log);
    // pubmedSearchTool.on(ToolEvent.RESULT, console.log);
    // pubmedAbstractTool.on(ToolEvent.EXECUTE, console.log);
    // Ask which model to use
    const modelChoice = await rl.question(
      "Which model would you like to use? [1] Claude (default) or [2] OpenAI: "
    );

    if (modelChoice === "2") {
      agent = openAiMedicalAgent;
      console.log("Using OpenAI model");
    } else {
      console.log("Using Claude model");
    }

    console.log("\n----- Medical Research Assistant -----");
    console.log(
      "Ask medical research questions and the assistant will search PubMed for you."
    );
    console.log("Type 'exit' to quit.");
    console.log("---------------------------------------\n");

    while (running) {
      const question = await rl.question(
        "\nWhat medical topic would you like to research? \n"
      );

      if (question.toLowerCase() === "exit") {
        running = false;
        continue;
      }

      console.log("\nSearching medical literature...");
      const result = await agent.execute(question);

      console.log("\n" + result);

      // Ask if the user wants to continue
      const continueResponse = await rl.question(
        "\nWould you like to ask another question? (y/n): "
      );
      if (continueResponse.toLowerCase() !== "y") {
        running = false;
      }
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    rl.close();
    process.exit(1);
  }
}

runMedicalResearchExample();
