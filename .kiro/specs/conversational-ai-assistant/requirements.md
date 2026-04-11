# Requirements Document

## Introduction

Transform the existing Clorefy AI document builder chat into a general-purpose conversational AI assistant. Currently, the chat exclusively generates documents (invoices, contracts, quotations, proposals) by always responding with JSON document data. The goal is to enable natural conversational interactions — answering questions, discussing attached file contents, and providing business guidance — while preserving the existing document generation capability on demand. The AI should intelligently detect user intent and route responses accordingly: plain text for conversation, JSON for document generation.

## Glossary

- **Chat_Interface**: The primary user-facing chat component (`components/invoice-chat.tsx`) through which users interact with the AI assistant
- **Intent_Classifier**: The logic layer that analyzes a user message and determines whether the user wants to generate a document, ask a conversational question, or discuss an attached file
- **Stream_Endpoint**: The server-side API route (`/api/ai/stream`) that receives user messages, constructs prompts, and streams AI responses back to the client
- **System_Prompt**: The instruction set sent to the DeepSeek model that defines the AI's behavior, response format, and capabilities
- **File_Analysis_Endpoint**: The server-side API route (`/api/ai/analyze-file`) that uses GPT to extract or analyze content from uploaded files
- **Conversation_Response**: A plain text (non-JSON) response from the AI intended for conversational interaction
- **Document_Response**: A JSON-structured response from the AI containing document data for preview rendering
- **File_Context**: Extracted or summarized content from an uploaded file that is retained in the conversation for follow-up questions
- **Legal_Disclaimer**: A standard notice appended to responses containing legal, tax, or financial advice, stating the information is not professional advice
- **Conversation_History**: The ordered sequence of user and assistant messages within a session, used to maintain context across turns
- **DeepSeek_Model**: The DeepSeek V3 Chat model used for all text-based AI interactions (both conversational and document generation)
- **GPT_Model**: The OpenAI GPT-5.4 model used exclusively for file content analysis and extraction

## Requirements

### Requirement 1: Intent Detection

**User Story:** As a user, I want the AI to understand whether I am asking a question or requesting a document, so that I receive the appropriate type of response without having to specify my intent explicitly.

#### Acceptance Criteria

1. WHEN a user sends a message that contains an explicit document generation request (e.g., "create an invoice", "generate a quotation for", "make a contract"), THE Intent_Classifier SHALL classify the intent as document generation and THE Stream_Endpoint SHALL return a Document_Response.
2. WHEN a user sends a message that is a general question or conversational statement (e.g., "what is GST?", "how do payment terms work?", "hello"), THE Intent_Classifier SHALL classify the intent as conversational and THE Stream_Endpoint SHALL return a Conversation_Response in plain text.
3. WHEN a user sends a message that references an attached file's contents (e.g., "what does this document say?", "summarize the file", "what is the total in the attachment?"), THE Intent_Classifier SHALL classify the intent as file discussion and THE Stream_Endpoint SHALL return a Conversation_Response discussing the file contents.
4. WHEN a user sends an ambiguous message that could be either conversational or document-related, THE Intent_Classifier SHALL default to a Conversation_Response and ask the user for clarification.

### Requirement 2: Conversational Response Mode

**User Story:** As a user, I want to ask the AI general questions about business, invoicing, contracts, and other topics and receive helpful plain text answers, so that I can use the chat as a knowledgeable assistant.

#### Acceptance Criteria

1. WHEN the Intent_Classifier classifies a message as conversational, THE Stream_Endpoint SHALL instruct the DeepSeek_Model to respond in plain text using Markdown formatting (headings, lists, bold, code blocks) rather than JSON document data.
2. THE System_Prompt SHALL define the AI as a knowledgeable business assistant capable of answering questions about invoicing, contracts, quotations, proposals, tax compliance, payment terms, and general business topics.
3. WHEN the AI generates a Conversation_Response, THE Chat_Interface SHALL render the response using the existing MarkdownMessage component with standard chat bubble styling.
4. WHILE the AI is generating a Conversation_Response, THE Chat_Interface SHALL display a thinking indicator with the label "Thinking..." instead of "Generating invoice..." or similar document-specific labels.

### Requirement 3: Document Generation Preservation

**User Story:** As a user, I want to still be able to generate invoices, contracts, quotations, and proposals through the chat, so that the existing document creation workflow continues to work.

#### Acceptance Criteria

1. WHEN the Intent_Classifier classifies a message as document generation, THE Stream_Endpoint SHALL instruct the DeepSeek_Model to respond with JSON in the existing `{ "document": {...}, "message": "..." }` format.
2. THE Chat_Interface SHALL continue to parse JSON responses, apply document data to the preview panel, recalculate totals client-side, and display the assistant message — using the same logic as the current implementation.
3. WHEN a Document_Response is received, THE Chat_Interface SHALL set the document-generated state and display the NextStepsBar for linked document creation.
4. THE System_Prompt SHALL retain all existing document generation rules including math/calculation rules, document content rules, template detection, country-specific compliance, and business context handling.

### Requirement 4: File Content Discussion

**User Story:** As a user, I want to upload a file and then ask follow-up questions about its contents, so that I can understand and discuss the document before deciding whether to generate anything from it.

#### Acceptance Criteria

1. WHEN a user uploads a file without an explicit document generation request, THE File_Analysis_Endpoint SHALL extract the file contents and return a structured summary to the client.
2. WHEN file contents have been extracted, THE Chat_Interface SHALL store the extracted File_Context in the conversation state and include it in subsequent messages to the Stream_Endpoint.
3. WHEN a user asks a follow-up question about a previously uploaded file, THE Stream_Endpoint SHALL include the stored File_Context in the prompt so the DeepSeek_Model can answer questions about the file contents.
4. WHEN a user uploads a file and includes an explicit document generation request (e.g., "create an invoice from this"), THE File_Analysis_Endpoint SHALL operate in the existing generation mode and return a Document_Response.

### Requirement 5: Conversation Memory

**User Story:** As a user, I want the AI to remember what we discussed earlier in the conversation, so that I can have a coherent multi-turn dialogue without repeating myself.

#### Acceptance Criteria

1. THE Chat_Interface SHALL include the most recent conversation messages (up to a configurable window) in each request to the Stream_Endpoint as the conversationHistory field.
2. WHEN the Stream_Endpoint receives a conversationHistory, THE System_Prompt SHALL instruct the DeepSeek_Model to use the conversation history to maintain context and provide coherent follow-up responses.
3. WHEN a user starts a new session, THE Conversation_History SHALL be empty and the AI SHALL greet the user with a welcome message that reflects the new dual-purpose capability (both document generation and general chat).
4. THE Stream_Endpoint SHALL limit the conversationHistory to the most recent 10 message pairs to prevent token limit exhaustion while maintaining sufficient context.

### Requirement 6: File Context Retention

**User Story:** As a user, I want the AI to remember the contents of a file I uploaded earlier in the conversation, so that I can ask multiple questions about it without re-uploading.

#### Acceptance Criteria

1. WHEN a file is analyzed by the File_Analysis_Endpoint, THE Chat_Interface SHALL store the extracted File_Context alongside the conversation messages for the duration of the session.
2. WHEN the user sends a subsequent message in the same session, THE Chat_Interface SHALL include the stored File_Context in the request payload to the Stream_Endpoint.
3. WHEN a user uploads a new file in the same session, THE Chat_Interface SHALL replace the previous File_Context with the newly extracted content.
4. WHEN a user starts a new session, THE Chat_Interface SHALL clear any stored File_Context from the previous session.

### Requirement 7: Legal Disclaimer for Advice

**User Story:** As a user, I want to receive appropriate disclaimers when the AI provides legal, tax, or financial advice, so that I understand the limitations of AI-generated guidance.

#### Acceptance Criteria

1. WHEN the DeepSeek_Model generates a Conversation_Response that contains legal, tax, or financial advice, THE System_Prompt SHALL instruct the model to append a Legal_Disclaimer at the end of the response.
2. THE Legal_Disclaimer SHALL state: "⚠️ This is general information only and not professional legal, tax, or financial advice. Please consult a qualified professional for advice specific to your situation."
3. THE System_Prompt SHALL define the categories that trigger a Legal_Disclaimer: tax rates, tax compliance, legal obligations, contract law, financial regulations, liability, and dispute resolution.
4. WHEN the AI provides factual information that does not constitute advice (e.g., "GST stands for Goods and Services Tax"), THE System_Prompt SHALL instruct the model to omit the Legal_Disclaimer.

### Requirement 8: Dual-Mode System Prompt

**User Story:** As a developer, I want a unified system prompt that supports both conversational and document generation modes, so that the AI can seamlessly switch between response types within a single session.

#### Acceptance Criteria

1. THE System_Prompt SHALL contain two clearly separated sections: one for conversational behavior and one for document generation behavior.
2. THE System_Prompt SHALL instruct the DeepSeek_Model to determine the response mode based on the user's intent: respond with plain text for questions and conversation, respond with JSON for document generation requests.
3. THE System_Prompt SHALL instruct the DeepSeek_Model to never respond with JSON document data unless the user explicitly requests document creation or modification.
4. THE System_Prompt SHALL retain all existing document generation instructions (math rules, compliance rules, template detection, business context handling) within the document generation section.
5. THE System_Prompt SHALL instruct the DeepSeek_Model to use the user's business profile context to personalize conversational responses (e.g., referencing the user's country for tax questions).

### Requirement 9: Response Format Detection on Client

**User Story:** As a developer, I want the Chat_Interface to correctly detect whether an AI response is a document or a conversation, so that it renders the appropriate UI for each response type.

#### Acceptance Criteria

1. WHEN the Stream_Endpoint returns a response that starts with `{` and contains a valid JSON object with a `document` key, THE Chat_Interface SHALL treat it as a Document_Response and apply the document data to the preview panel.
2. WHEN the Stream_Endpoint returns a response that is not valid JSON or does not contain a `document` key, THE Chat_Interface SHALL treat it as a Conversation_Response and render it as a Markdown chat message.
3. IF the Stream_Endpoint returns malformed JSON that cannot be parsed, THEN THE Chat_Interface SHALL fall back to rendering the raw text as a Conversation_Response rather than showing an error.
4. THE Chat_Interface SHALL use the same SSE streaming protocol for both response types, with the `complete` event containing either JSON or plain text.

### Requirement 10: Updated Welcome Experience

**User Story:** As a user, I want the welcome message to reflect that I can both chat and create documents, so that I understand the full capabilities of the assistant.

#### Acceptance Criteria

1. WHEN a new session starts, THE Chat_Interface SHALL display a welcome message that communicates both conversational and document generation capabilities.
2. THE welcome message SHALL include example prompts for both modes: at least one document generation example and one conversational question example.
3. THE Chat_Interface header SHALL display "AI Assistant" instead of "Document Builder" to reflect the expanded capability.

### Requirement 11: Security and Authentication

**User Story:** As a developer, I want all new and modified endpoints to maintain the existing security posture, so that the conversational features do not introduce vulnerabilities.

#### Acceptance Criteria

1. THE Stream_Endpoint SHALL continue to require authentication via `authenticateRequest()` for all requests, including conversational messages.
2. THE Stream_Endpoint SHALL continue to enforce input sanitization via `sanitizeText()` on all user prompts, regardless of intent classification.
3. THE Stream_Endpoint SHALL continue to enforce the existing rate limits and cost protection checks for all request types.
4. THE Stream_Endpoint SHALL continue to validate request origin and enforce body size limits for all request types.
5. IF a user sends a prompt that attempts to override the System_Prompt or inject instructions, THEN THE System_Prompt SHALL instruct the DeepSeek_Model to ignore the injection and respond normally.
