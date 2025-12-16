# Knowledge Base Upload System - Setup Guide

## Overview

This system allows admins to upload documents, videos, URLs, and text content to build a dynamic RAG-powered knowledge base for the AI SDR. Just like NotebookLM, teams can continuously add product docs, demo videos, engineering updates, and sales content to make the AI smarter.

## Features

### Supported Content Types

1. **📄 Documents**
   - PDF files
   - DOCX (Word documents)
   - TXT (Plain text)
   - Automatically extracts and processes text

2. **🎥 Videos**
   - YouTube URLs (with auto-transcription)
   - Extracts transcript and key information
   - Future: Direct video file upload

3. **🔗 URLs**
   - Web pages and articles
   - Documentation sites
   - Blog posts
   - Automatically extracts main content

4. **📝 Text**
   - Direct text input
   - Copy-paste content
   - Quick notes and updates

### Processing Pipeline

```
Upload → Extract Text → Generate Summary → Create Chunks → Generate Embeddings → Store in DB
```

### Categories

- **Product**: Product features, documentation
- **Sales**: Sales playbooks, pitch decks
- **Technical**: Technical specs, architecture
- **Customer Story**: Case studies, testimonials
- **Objection Handling**: Responses to common objections

## Installation

### 1. Install Required NPM Packages

```bash
cd app
npm install pdf-parse mammoth youtube-transcript
```

### 2. Run Prisma Migration

```bash
cd app
npx prisma migrate dev --name add_knowledge_sources
npx prisma generate
```

This creates the `KnowledgeSource` table in your database.

### 3. Verify Environment Variables

Make sure `OPENAI_API_KEY` is set in both:
- `app/.env`
- `backend/.env`

## Database Schema

```prisma
model KnowledgeSource {
  id                String    @id @default(uuid())
  userId            String
  
  title             String
  description       String?
  type              String    // 'document', 'video', 'url', 'text'
  
  // File/URL info
  fileUrl           String?
  fileName          String?
  fileSize          Int?
  mimeType          String?
  
  // Video-specific
  videoUrl          String?
  videoDuration     Int?
  videoTranscript   String?
  
  // Processed content
  content           String    @db.Text
  summary           String?
  
  // Embeddings for semantic search
  embeddings        Json?
  chunks            Json?     // Array of text chunks with embeddings
  
  // Metadata
  tags              String[]
  category          String?
  isActive          Boolean   @default(true)
  
  // Processing status
  status            String    @default("pending")
  processingError   String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

## Usage

### Admin UI

Navigate to: `http://localhost:3000/knowledge`

### Upload Document

1. Click "Add Knowledge"
2. Select "Document" type
3. Enter title and description
4. Choose category (Product, Sales, Technical, etc.)
5. Add tags (comma-separated)
6. Upload PDF, DOCX, or TXT file
7. Click "Upload & Process"

### Upload Video

1. Click "Add Knowledge"
2. Select "Video" type
3. Enter title and description
4. Paste YouTube URL
5. System will auto-transcribe the video
6. Click "Upload & Process"

### Upload URL

1. Click "Add Knowledge"
2. Select "URL" type
3. Enter title and description
4. Paste article/documentation URL
5. System will extract main content
6. Click "Upload & Process"

### Upload Text

1. Click "Add Knowledge"
2. Select "Text" type
3. Enter title and description
4. Paste or type content
5. Click "Upload & Process"

## Processing Status

- **⏳ Pending**: Upload received, queued for processing
- **🔄 Processing**: Extracting text, generating embeddings
- **✅ Completed**: Ready to use in AI conversations
- **❌ Failed**: Processing error (check logs)

## How It Enhances AI SDR

### Before (Static Knowledge)
```
User: "Tell me about your integration with Salesforce"
AI: "We integrate with many tools including Salesforce."
```

### After (Dynamic Knowledge)
```
User: "Tell me about your integration with Salesforce"
[RAG retrieves from uploaded Salesforce integration doc]
AI: "Great question! Our Salesforce integration syncs contacts, 
     opportunities, and activities in real-time. You can trigger 
     workflows directly from Salesforce, and all call data flows 
     back automatically. We also support custom fields and 
     multi-org setups. Would you like to see a demo?"
```

## RAG Integration

The system uses semantic search with embeddings:

1. **Question comes in** → Generate embedding
2. **Search knowledge base** → Find similar chunks (cosine similarity)
3. **Retrieve top 3 chunks** → Most relevant content
4. **Inject into AI prompt** → Contextual response

### Example Flow

```javascript
User: "What's your uptime SLA?"

1. Generate embedding for question
2. Search all knowledge sources
3. Find relevant chunk from "SLA Documentation.pdf"
4. AI responds: "We guarantee 99.9% uptime with a 
   4-hour response time for critical issues..."
```

## API Endpoints

### Upload Knowledge
```
POST /api/knowledge/upload
Content-Type: multipart/form-data

Body:
- title: string (required)
- description: string
- type: 'document' | 'video' | 'url' | 'text'
- category: string
- tags: string (comma-separated)
- file: File (for documents)
- videoUrl: string (for videos)
- url: string (for URLs)
- content: string (for text)
```

### List Knowledge Sources
```
GET /api/knowledge
Query params:
- category: string (optional)
- status: string (optional)
```

### Delete Knowledge Source
```
DELETE /api/knowledge?id={id}
```

## Best Practices

### 1. Organize by Category
- Use categories consistently
- Makes retrieval more accurate
- Easier to manage

### 2. Add Descriptive Tags
- Include product names
- Feature names
- Use cases
- Helps with search

### 3. Keep Content Updated
- Delete outdated content
- Re-upload updated versions
- Mark old content as inactive

### 4. Use Clear Titles
- Descriptive, not generic
- Include version numbers if applicable
- Example: "Product Demo Q4 2024" not "Demo"

### 5. Add Context in Descriptions
- When was this created?
- Who is the audience?
- What's the key takeaway?

## Example Use Cases

### Product Team Updates
```
Type: Video
Title: "Q4 Product Roadmap - New AI Features"
Category: Product
Tags: roadmap, AI, automation, 2024
Video: Internal product demo
```

### Sales Playbook
```
Type: Document
Title: "Enterprise Sales Playbook v2.1"
Category: Sales
Tags: enterprise, playbook, objections
File: sales-playbook.pdf
```

### Customer Success Story
```
Type: Text
Title: "TechCorp Implementation - 85% Ticket Reduction"
Category: Customer Story
Tags: case study, IT, automation
Content: [Paste case study]
```

### Technical Documentation
```
Type: URL
Title: "API Integration Guide"
Category: Technical
Tags: API, integration, developers
URL: https://docs.atomicwork.com/api
```

## Monitoring

### Check Processing Status
```sql
SELECT title, status, processingError 
FROM KnowledgeSource 
WHERE status = 'failed';
```

### View Recent Uploads
```sql
SELECT title, type, category, createdAt 
FROM KnowledgeSource 
ORDER BY createdAt DESC 
LIMIT 10;
```

### Search by Category
```sql
SELECT title, summary 
FROM KnowledgeSource 
WHERE category = 'product' 
AND isActive = true;
```

## Troubleshooting

### Upload Fails
- Check file size (max 10MB recommended)
- Verify file format (PDF, DOCX, TXT only)
- Check OPENAI_API_KEY is set

### Processing Stuck
- Check backend logs
- Verify OpenAI API quota
- Restart processing manually

### Poor Search Results
- Add more descriptive content
- Use better tags
- Increase chunk overlap
- Adjust similarity threshold

## Future Enhancements

### Phase 2: Vector Database
- Migrate to Pinecone/Weaviate
- Faster semantic search
- Better scaling

### Phase 3: Multi-modal
- Image extraction from PDFs
- Screenshot analysis
- Diagram understanding

### Phase 4: Auto-sync
- Google Drive integration
- Notion sync
- Confluence connector
- Auto-update on changes

### Phase 5: Analytics
- Track which knowledge is used most
- Identify gaps in knowledge base
- A/B test different content

## Security

- All uploads are user-scoped
- Only accessible by the uploading user
- Files stored securely (when using S3)
- Embeddings are encrypted at rest

## Performance

- **Upload**: ~2-5 seconds (small docs)
- **Processing**: ~10-30 seconds (depends on size)
- **Embedding Generation**: ~1-3 seconds per chunk
- **Search**: <100ms (in-memory)

## Cost Considerations

### OpenAI API Costs
- Embeddings: ~$0.0001 per 1K tokens
- Summary generation: ~$0.002 per 1K tokens
- Typical document (10 pages): ~$0.05

### Storage
- Text content: Minimal
- Embeddings: ~4KB per chunk
- 100 documents: ~400KB embeddings

## Support

For issues or questions:
1. Check backend logs: `backend/logs`
2. Check processing errors in database
3. Verify OpenAI API key and quota
4. Review this documentation

---

**Ready to build your AI's brain!** 🧠

Upload your first document and watch your AI SDR get smarter with every piece of content.
