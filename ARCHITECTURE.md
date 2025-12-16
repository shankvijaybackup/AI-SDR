# AI SDR Outbound - Technical Architecture

## Overview
Full-stack AI-powered SDR calling platform with LinkedIn enrichment, lead management, and automated follow-up.

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: TailwindCSS + shadcn/ui
- **State Management**: React Context + SWR for data fetching
- **Forms**: React Hook Form + Zod validation
- **Real-time**: WebSocket for live call transcription

### Backend
- **Runtime**: Node.js (Express - existing)
- **API**: Next.js API Routes + Express endpoints
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Voice**: Twilio + ElevenLabs (existing)
- **AI**: OpenAI GPT-4o-mini (existing)

### Infrastructure
- **File Storage**: Local filesystem (CSV uploads, TTS files)
- **Session Management**: JWT tokens + HTTP-only cookies
- **LinkedIn Scraping**: Puppeteer with session cookies

## Database Schema

### Users
```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  password          String   // bcrypt hashed
  firstName         String
  lastName          String
  company           String?
  role              String?  // "SDR", "Manager", "Admin"
  linkedinSessionCookie String? @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  leads             Lead[]
  scripts           Script[]
  calls             Call[]
}
```

### Leads
```prisma
model Lead {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  firstName         String
  lastName          String
  email             String?
  phone             String
  company           String?
  jobTitle          String?
  linkedinUrl       String?
  notes             String?  @db.Text
  
  // LinkedIn enrichment data
  linkedinEnriched  Boolean  @default(false)
  linkedinData      Json?    // Store full LinkedIn profile data
  
  // Call status
  status            String   @default("pending") // "pending", "scheduled", "completed", "not_interested"
  interestLevel     String?  // "high", "medium", "low", "none"
  nextFollowUp      DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  calls             Call[]
  
  @@index([userId, status])
  @@index([userId, interestLevel])
}
```

### Scripts
```prisma
model Script {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name              String
  content           String   @db.Text // Template with {{placeholders}}
  isDefault         Boolean  @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  calls             Call[]
  
  @@index([userId])
}
```

### Calls
```prisma
model Call {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  leadId            String
  lead              Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  scriptId          String?
  script            Script?  @relation(fields: [scriptId], references: [id], onDelete: SetNull)
  
  twilioCallSid     String?  @unique
  voicePersona      String   @default("female") // "male", "female"
  
  // Call data
  transcript        Json     // Array of {speaker, text, timestamp}
  duration          Int?     // seconds
  status            String   @default("initiated") // "initiated", "in_progress", "completed", "failed"
  
  // AI analysis
  aiSummary         String?  @db.Text
  interestLevel     String?  // "high", "medium", "low", "none"
  objections        String[] // Array of objection strings
  emailCaptured     String?
  nextSteps         String?  @db.Text
  scheduledDemo     DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId, leadId])
  @@index([twilioCallSid])
}
```

## Application Architecture

### Directory Structure
```
ai-sdr-outbound/
├── backend/                    # Existing Express backend
│   ├── server.js
│   ├── openaiClient.js
│   ├── callState.js
│   └── ...
├── frontend/                   # New Next.js frontend
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── leads/
│   │   │   ├── scripts/
│   │   │   ├── calling/
│   │   │   └── follow-ups/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── leads/
│   │   │   ├── linkedin/
│   │   │   └── calls/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── leads/
│   │   ├── calling/
│   │   └── scripts/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   └── linkedin.ts
│   └── prisma/
│       └── schema.prisma
└── shared/                     # Shared types/utils
```

## Key Features Implementation

### 1. Authentication Flow
- Email/password registration with bcrypt
- JWT token stored in HTTP-only cookie
- Middleware to protect routes
- LinkedIn session cookie storage (encrypted)

### 2. Lead Management
- CSV upload with drag-and-drop (react-dropzone)
- Column mapping interface
- Bulk import with validation
- Lead list with filtering, sorting, search
- Status tracking (pending → scheduled → completed)

### 3. LinkedIn Enrichment
- Puppeteer headless browser
- Use rep's LinkedIn session cookie
- Scrape public profile data:
  - Name, headline, current role
  - Company, tenure
  - Recent posts/activity
  - Shared connections
- Store in `linkedinData` JSON field
- Rate limiting to avoid detection

### 4. Script Templates
- Rich text editor with variable insertion
- Variables: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{linkedinInsight}}
- Preview with real lead data
- Save multiple templates per user

### 5. Calling Interface
- WebSocket connection for real-time updates
- Live transcription display
- AI response preview
- Call controls (pause, resume, hang up)
- Progress indicator (rapport → discovery → consultative → pitch → email_capture)

### 6. Follow-up Management
- Email capture form
- Calendar integration (Google Calendar API)
- Automated email templates
- Follow-up reminders

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Leads
- `GET /api/leads` - List leads (with filters)
- `POST /api/leads` - Create lead
- `POST /api/leads/upload` - CSV upload
- `GET /api/leads/:id` - Get lead details
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### LinkedIn
- `POST /api/linkedin/connect` - Save LinkedIn session
- `POST /api/linkedin/enrich/:leadId` - Enrich lead profile
- `GET /api/linkedin/profile/:leadId` - Get enriched data

### Scripts
- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Create script
- `PATCH /api/scripts/:id` - Update script
- `DELETE /api/scripts/:id` - Delete script

### Calls
- `POST /api/calls/initiate` - Start call
- `GET /api/calls/:id` - Get call details
- `GET /api/calls/lead/:leadId` - Get lead's call history
- `WS /api/calls/live/:callId` - WebSocket for live updates

## Security Considerations

### LinkedIn Scraping
- Encrypt session cookies at rest
- Rate limit requests (max 10 profiles/hour)
- Rotate user agents
- Add random delays between requests
- Handle CAPTCHA detection gracefully

### Data Protection
- Hash passwords with bcrypt (12 rounds)
- JWT tokens expire in 7 days
- HTTPS only in production
- CORS configured for frontend origin
- SQL injection protection via Prisma

### Privacy
- Clear consent for LinkedIn data usage
- Allow users to delete their data
- Don't store sensitive LinkedIn credentials
- Audit logs for data access

## Integration with Existing Backend

### Approach
1. Keep existing Express backend for Twilio webhooks
2. Next.js API routes for new features
3. Shared Prisma client between both
4. WebSocket server for real-time call updates
5. Backend updates call records in database

### Migration Path
1. Add Prisma to existing backend
2. Migrate in-memory call state to database
3. Add user authentication to Twilio endpoints
4. Link calls to leads via `leadId`

## Development Phases

### Phase 1: Foundation (Current)
- Set up Next.js project
- Configure Prisma + PostgreSQL
- Implement authentication
- Basic UI layout

### Phase 2: Lead Management
- CSV upload
- Lead dashboard
- CRUD operations

### Phase 3: LinkedIn Integration
- Session cookie storage
- Profile enrichment
- Data display

### Phase 4: Calling
- Script templates
- Voice persona selection
- Call initiation
- Live transcription

### Phase 5: Follow-up
- Email capture
- Calendar integration
- Automated emails

### Phase 6: Polish
- Error handling
- Loading states
- Analytics dashboard
- Performance optimization
