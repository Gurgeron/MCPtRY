import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import { z } from "zod";
import { docs_v1, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import 'dotenv/config';

// Set up OAuth2.0 scopes - we need full access to Docs and Drive
const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.readonly" // Add read-only scope as a fallback
];

// Resolve paths relative to the project root
const PROJECT_ROOT_RAW = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = decodeURIComponent(path.resolve(path.join(PROJECT_ROOT_RAW, '..')));

// The token path is where we'll store the OAuth credentials
const TOKEN_PATH = path.join(PROJECT_ROOT, "token.json");

// The credentials path is where your OAuth client credentials are stored
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");

console.log("PROJECT_ROOT_RAW:", PROJECT_ROOT_RAW);
console.log("PROJECT_ROOT:", PROJECT_ROOT);
console.log("CREDENTIALS_PATH:", CREDENTIALS_PATH);
console.log("TOKEN_PATH:", TOKEN_PATH);

// Create an MCP server instance
const server = new McpServer({
  name: "google-docs",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// 🌱 Environment configuration
// ---------------------------------------------------------------------------
// We prefer reading sensitive credentials from environment variables so that
// they can be injected at runtime by container orchestrators (or a local
// `.env` file which is git-ignored).  This avoids persisting tokens in the
// workspace and keeps secrets out of version control.
//
// Supported variables:
//   ‑ GOOGLE_DOCS_TOKEN_JSON       – JSON string with OAuth access + refresh token
//   ‑ GOOGLE_DOCS_CREDENTIALS_JSON – JSON string with the client credentials
//
// If the variables are **not** defined we gracefully fall back to the legacy
// `credentials.json` / `token.json` files on disk so existing users are not
// broken.

/**
 * Load saved credentials if they exist, otherwise trigger the OAuth flow
 */
async function authorize() {
  try {
    // 1) --------------------------------------------------------------
    // Attempt to build the OAuth2 client **purely from env variables**.
    // -----------------------------------------------------------------
    const rawCreds = process.env.GOOGLE_DOCS_CREDENTIALS_JSON;
    const rawToken = process.env.GOOGLE_DOCS_TOKEN_JSON;

    if (rawCreds && rawToken) {
      console.error("🔑 Loading Google Docs credentials from environment …");
      const keys = JSON.parse(rawCreds);
      const token = JSON.parse(rawToken);

      const { client_id, client_secret, redirect_uris } = keys.installed ?? keys.web ?? {};
      const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0]);
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }

    // 2) --------------------------------------------------------------
    // Legacy disk-based flow (credentials.json / token.json)
    // -----------------------------------------------------------------
    // Load client secrets from a local file
    console.error("Reading credentials from:", CREDENTIALS_PATH);
    const content = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
    const keys = JSON.parse(content);
    const clientId = keys.installed.client_id;
    const clientSecret = keys.installed.client_secret;
    const redirectUri = keys.installed.redirect_uris[0];
    
    console.error("Using client ID:", clientId);
    console.error("Using redirect URI:", redirectUri);
    
    // Create an OAuth2 client
    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    // Check if we have previously stored a token…
    // (Skip if we already loaded from env variables).
    if (fs.existsSync(TOKEN_PATH)) {
      console.error("Found existing token on disk, attempting to use it…");
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }
    
    // No token found, use the local-auth library to get one
    console.error("No token found, starting OAuth flow...");
    const client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    
    if (client.credentials) {
      console.error("Authentication successful, saving token...");
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
      console.error("Token saved successfully to:", TOKEN_PATH);
    } else {
      console.error("Authentication succeeded but no credentials returned");
    }
    
    return client;
  } catch (err) {
    console.error("Error authorizing with Google:", err);
    if (err.message) console.error("Error message:", err.message);
    if (err.stack) console.error("Stack trace:", err.stack);
    throw err;
  }
}

// Create Docs and Drive API clients
let docsClient: docs_v1.Docs;
let driveClient: drive_v3.Drive;

// Initialize Google API clients
async function initClients() {
  try {
    console.error("Starting client initialization...");
    const auth = await authorize();
    console.error("Auth completed successfully:", !!auth);
    docsClient = google.docs({ version: "v1", auth: auth as any });
    console.error("Docs client created:", !!docsClient);
    driveClient = google.drive({ version: "v3", auth: auth as any });
    console.error("Drive client created:", !!driveClient);
    return true;
  } catch (error) {
    console.error("Failed to initialize Google API clients:", error);
    return false;
  }
}

// Initialize clients when the server starts
initClients().then((success) => {
  if (!success) {
    console.error("Failed to initialize Google API clients. Server will not work correctly.");
  } else {
    console.error("Google API clients initialized successfully.");
  }
});

// RESOURCES

// Resource for listing documents
server.resource(
  "list-docs",
  "googledocs://list",
  async (uri) => {
    try {
      const response = await driveClient.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        fields: "files(id, name, createdTime, modifiedTime)",
        pageSize: 50,
      });

      const files = response.data.files || [];
      
      // Format the response in a user-friendly way
      let content = "";
      
      if (files.length === 0) {
        content = "I couldn't find any Google Docs in your Drive.";
      } else {
        content = `I found ${files.length} documents in your Google Drive:\n\n`;
        
        files.forEach((file: any, index: number) => {
          // Format dates to be more readable
          const created = new Date(file.createdTime).toLocaleDateString();
          const modified = new Date(file.modifiedTime).toLocaleDateString();
          
          content += `${index + 1}. "${file.name}"\n`;
          content += `   - Created: ${created}\n`;
          content += `   - Last edited: ${modified}\n`;
          content += `   - ID: ${file.id}\n\n`;
        });
        
        content += "Would you like me to open any specific document or help you with something else?";
      }

      return {
        contents: [{
          uri: uri.href,
          text: content,
        }]
      };
    } catch (error) {
      console.error("Error listing documents:", error);
      return {
        contents: [{
          uri: uri.href,
          text: `I encountered an issue while listing your documents: ${error instanceof Error ? error.message : String(error)}`,
        }]
      };
    }
  }
);

// Resource to get a specific document by ID
server.resource(
  "get-doc",
  new ResourceTemplate("googledocs://{docId}", { list: undefined }),
  async (uri, { docId }) => {
    try {
      const doc = await docsClient.documents.get({
        documentId: docId as string,
      });
      
      // Extract the document content
      const document = doc.data;
      const title = document.title || "Untitled Document";
      
      // Format the response header with document metadata
      let content = `I've opened "${title}" for you.\n\n`;
      
      // Add document ID
      content += `Document ID: ${docId}\n\n`;
      content += `--- Document Content ---\n\n`;
      
      // Process the document content from the complex data structure
      if (document && document.body && document.body.content) {
        let textContent = "";
        
        // Loop through the document's structural elements
        document.body.content.forEach((element: any) => {
          if (element.paragraph) {
            element.paragraph.elements.forEach((paragraphElement: any) => {
              if (paragraphElement.textRun && paragraphElement.textRun.content) {
                textContent += paragraphElement.textRun.content;
              }
            });
          }
        });
        
        content += textContent;
      } else {
        content += "This document appears to be empty.";
      }
      
      content += "\n\n--- End of Document ---\n\n";
      content += "Would you like me to help you edit this document or perform another action?";

      return {
        contents: [{
          uri: uri.href,
          text: content,
        }]
      };
    } catch (error) {
      console.error(`Error getting document ${docId}:`, error);
      return {
        contents: [{
          uri: uri.href,
          text: `I couldn't open the document (ID: ${docId}). The error was: ${error instanceof Error ? error.message : String(error)}`,
        }]
      };
    }
  }
);

// TOOLS

// Tool to create a new document
server.tool(
  "create-doc",
  {
    title: z.string().describe("The title of the new document"),
    content: z.string().optional().describe("Optional initial content for the document"),
  },
  async ({ title, content = "" }) => {
    try {
      // Create a new document
      const doc = await docsClient.documents.create({
        requestBody: {
          title: title,
        },
      });

      const documentId = doc.data.documentId;

      // If content was provided, add it to the document
      if (content) {
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: content,
                },
              },
            ],
          },
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `I've created a new document titled "${title}" for you!

You can access it with document ID: ${documentId}

${content ? "I've also added your initial content to the document." : "The document is currently empty and ready for you to add content."} 

Would you like me to help you with anything else?`,
          },
        ],
      };
    } catch (error) {
      console.error("Error creating document:", error);
      return {
        content: [
          {
            type: "text",
            text: `I encountered an issue while creating your document: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool to update an existing document
server.tool(
  "update-doc",
  {
    docId: z.string().describe("The ID of the document to update"),
    content: z.string().describe("The content to add to the document"),
    replaceAll: z.boolean().optional().describe("Whether to replace all content (true) or append (false)"),
  },
  async ({ docId, content, replaceAll = false }) => {
    try {
      // Ensure docId is a string and not null/undefined
      if (!docId) {
        throw new Error("Document ID is required");
      }
      
      const documentId = docId.toString();

      // First, get the document title
      const doc = await docsClient.documents.get({
        documentId,
      });
      
      const title = doc.data.title || "Untitled Document";
      
      if (replaceAll) {
        // Calculate the document length
        let documentLength = 1; // Start at 1 (the first character position)
        if (doc.data.body && doc.data.body.content) {
          doc.data.body.content.forEach((element: any) => {
            if (element.paragraph) {
              element.paragraph.elements.forEach((paragraphElement: any) => {
                if (paragraphElement.textRun && paragraphElement.textRun.content) {
                  documentLength += paragraphElement.textRun.content.length;
                }
              });
            }
          });
        }
        
        // Delete all content and then insert new content
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: 1,
                    endIndex: documentLength,
                  },
                },
              },
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: content,
                },
              },
            ],
          },
        });
      } else {
        // Calculate the document length to append at the end
        let documentLength = 1; // Start at 1 (the first character position)
        if (doc.data.body && doc.data.body.content) {
          doc.data.body.content.forEach((element: any) => {
            if (element.paragraph) {
              element.paragraph.elements.forEach((paragraphElement: any) => {
                if (paragraphElement.textRun && paragraphElement.textRun.content) {
                  documentLength += paragraphElement.textRun.content.length;
                }
              });
            }
          });
        }
        
        // Append content at the end
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: documentLength,
                  },
                  text: content,
                },
              },
            ],
          },
        });
      }
      
      return {
        content: [
          {
            type: "text",
            text: `I've ${replaceAll ? "replaced the content in" : "added new content to"} "${title}" (ID: ${docId}).

${replaceAll ? "The document now contains only the new content you provided." : "Your new content has been appended to the end of the document."}

Would you like me to help you with anything else?`,
          },
        ],
      };
    } catch (error) {
      console.error("Error updating document:", error);
      return {
        content: [
          {
            type: "text",
            text: `I encountered an issue while updating your document: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool to search for documents
server.tool(
  "search-docs",
  {
    query: z.string().describe("The search query to find documents"),
  },
  async ({ query }) => {
    try {
      const response = await driveClient.files.list({
        q: `mimeType='application/vnd.google-apps.document' and fullText contains '${query}'`,
        fields: "files(id, name, createdTime, modifiedTime)",
        pageSize: 10,
      });
      
      // Log only to server console, not to the user
      console.error("Drive API Response received successfully");
      
      // Add better response validation
      if (!response || !response.data) {
        throw new Error("Invalid response from Google Drive API");
      }
      
      // Add null check and default to empty array
      const files = (response.data.files || []);
      
      // Create a user-friendly response
      let content = `I found ${files.length} document(s) matching "${query}":\n\n`;
      
      if (files.length === 0) {
        content = `I couldn't find any documents matching "${query}" in your Google Drive.`;
      } else {
        files.forEach((file: any, index: number) => {
          // Format dates to be more readable
          const created = new Date(file.createdTime).toLocaleDateString();
          const modified = new Date(file.modifiedTime).toLocaleDateString();
          
          content += `${index + 1}. "${file.name}"\n`;
          content += `   - Created: ${created}\n`;
          content += `   - Last edited: ${modified}\n`;
          content += `   - ID: ${file.id}\n\n`;
        });
        
        content += `Would you like me to open any of these documents or perform another action?`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error("Error searching documents:", error);
      return {
        content: [
          {
            type: "text",
            text: `I encountered an issue while searching for documents: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool to delete a document
server.tool(
  "delete-doc",
  {
    docId: z.string().describe("The ID of the document to delete"),
  },
  async ({ docId }) => {
    try {
      // Get the document title first for confirmation
      const doc = await docsClient.documents.get({ documentId: docId });
      const title = doc.data.title || "Untitled Document";
      
      // Delete the document
      await driveClient.files.delete({
        fileId: docId,
      });

      return {
        content: [
          {
            type: "text",
            text: `I've deleted "${title}" from your Google Drive.

The document (ID: ${docId}) has been permanently removed.

Is there anything else you'd like me to help you with?`,
          },
        ],
      };
    } catch (error) {
      console.error(`Error deleting document ${docId}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `I couldn't delete the document (ID: ${docId}). The error was: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// PROMPTS

// Prompt for document creation
server.prompt(
  "create-doc-template",
  { 
    title: z.string().describe("The title for the new document"),
    subject: z.string().describe("The subject/topic the document should be about"),
    style: z.string().describe("The writing style (e.g., formal, casual, academic)"),
  },
  ({ title, subject, style }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please create a Google Doc with the title "${title}" about ${subject} in a ${style} writing style. Make sure it's well-structured with an introduction, main sections, and a conclusion.`
      }
    }]
  })
);

// Prompt for document analysis
server.prompt(
  "analyze-doc",
  { 
    docId: z.string().describe("The ID of the document to analyze"),
  },
  ({ docId }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please analyze the content of the document with ID ${docId}. Provide a summary of its content, structure, key points, and any suggestions for improvement.`
      }
    }]
  })
);

// Connect to the transport and start the server
async function main() {
  // Create a transport for communicating over stdin/stdout
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);
  
  console.error("Google Docs MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});