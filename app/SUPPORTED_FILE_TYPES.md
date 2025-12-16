# Supported File Types for Knowledge Base Upload

## Document Types

### PDF Files
- **Extensions:** `.pdf`
- **MIME Type:** `application/pdf`
- **Processing:** Text extraction using pdf-parse library
- **Use Case:** Product documentation, whitepapers, case studies

### Microsoft Word
- **Extensions:** `.doc`, `.docx`
- **MIME Types:** 
  - `application/msword` (DOC)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- **Processing:** Text extraction using mammoth library
- **Use Case:** Sales scripts, product descriptions, training materials

### Microsoft Excel
- **Extensions:** `.xls`, `.xlsx`
- **MIME Types:**
  - `application/vnd.ms-excel` (XLS)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)
- **Processing:** Sheet-by-sheet text extraction using xlsx library
- **Use Case:** Pricing tables, feature comparisons, customer data

### Microsoft PowerPoint
- **Extensions:** `.ppt`, `.pptx`
- **MIME Types:**
  - `application/vnd.ms-powerpoint` (PPT)
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
- **Processing:** Slide text extraction using officeparser library
- **Use Case:** Sales decks, product presentations, training slides

### Plain Text
- **Extensions:** `.txt`, `.md`, `.csv`
- **MIME Type:** `text/*`
- **Processing:** Direct UTF-8 text extraction
- **Use Case:** Simple notes, markdown documentation, CSV data

## Video Types

### MP4
- **Extension:** `.mp4`
- **MIME Type:** `video/mp4`
- **Processing:** Audio extraction via FFmpeg → Whisper transcription
- **Use Case:** Product demos, training videos, webinar recordings

### QuickTime (MOV)
- **Extension:** `.mov`
- **MIME Type:** `video/quicktime`
- **Processing:** Audio extraction via FFmpeg → Whisper transcription
- **Use Case:** Screen recordings, product walkthroughs

### AVI
- **Extension:** `.avi`
- **MIME Type:** `video/x-msvideo`
- **Processing:** Audio extraction via FFmpeg → Whisper transcription
- **Use Case:** Legacy video content

### MKV
- **Extension:** `.mkv`
- **MIME Type:** `video/x-matroska`
- **Processing:** Audio extraction via FFmpeg → Whisper transcription
- **Use Case:** High-quality video recordings

## Video Processing Workflow

1. **Upload** - Video file uploaded to server
2. **Audio Extraction** - FFmpeg extracts audio track to MP3 (128kbps)
3. **Size Check** - Audio must be < 25MB (Whisper API limit)
4. **Transcription** - OpenAI Whisper API transcribes audio to text
5. **Cleanup** - Temporary files deleted
6. **Embedding** - Text chunked and embedded for semantic search

## URL Types

### Web Pages
- **Input:** Any HTTP/HTTPS URL
- **Processing:** HTML content extraction, script/style removal
- **Use Case:** Blog posts, documentation sites, competitor pages

### YouTube Videos
- **Input:** YouTube video URL
- **Processing:** Automatic transcript extraction (if available)
- **Use Case:** Product demos, tutorials, customer testimonials

## Processing Pipeline

All uploaded content goes through:

1. **Text Extraction** - File-type specific extraction
2. **Chunking** - Split into 1000-char chunks with 200-char overlap
3. **Embedding** - OpenAI text-embedding-3-small model
4. **Summary** - GPT-4o-mini generates concise summary
5. **Storage** - Chunks + embeddings stored in Prisma database
6. **Search** - Semantic search via cosine similarity

## Limitations

- **Video Size:** Audio must be < 25MB after extraction
- **Video Length:** Recommend < 30 minutes for best results
- **File Size:** No hard limit, but large files may timeout
- **Languages:** English optimized (Whisper supports 99 languages)
- **OCR:** Not supported for scanned PDFs or images in documents

## Dependencies

- `pdf-parse` - PDF text extraction
- `mammoth` - Word document processing
- `xlsx` - Excel spreadsheet processing
- `officeparser` - PowerPoint processing
- `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` - Video audio extraction
- `openai` - Whisper transcription + embeddings
- `youtube-transcript` - YouTube transcript extraction
