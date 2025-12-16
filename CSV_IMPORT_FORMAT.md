# CSV Import Format Guide

## 📋 Leads CSV Format

### **Required Columns:**
```csv
firstName,lastName,phone,email,company,jobTitle,linkedinUrl,notes,status
```

### **Example: leads.csv**
```csv
firstName,lastName,phone,email,company,jobTitle,linkedinUrl,notes,status
John,Smith,+14155551234,john.smith@acme.com,Acme Corp,VP of Engineering,https://linkedin.com/in/johnsmith,Met at conference,pending
Sarah,Johnson,+14155555678,sarah.j@techco.io,TechCo,CTO,https://linkedin.com/in/sarahj,Warm lead from referral,pending
Michael,Chen,+14155559012,mchen@startup.com,StartupXYZ,Head of IT,https://linkedin.com/in/michaelchen,Interested in demo,pending
Emily,Davis,+14155553456,emily.davis@enterprise.com,Enterprise Inc,IT Director,,Cold outreach,pending
```

### **Field Details:**
- **firstName** (required): Lead's first name
- **lastName** (required): Lead's last name  
- **phone** (required): Phone number with country code (e.g., +1 for US)
- **email** (optional): Email address
- **company** (optional): Company name
- **jobTitle** (optional): Job title/role
- **linkedinUrl** (optional): LinkedIn profile URL
- **notes** (optional): Any notes about the lead
- **status** (optional): Default is "pending", can be "contacted", "interested", "not_interested"

---

## 📝 Scripts CSV Format

### **Required Columns:**
```csv
name,content,isDefault
```

### **Example: scripts.csv**
```csv
name,content,isDefault
Default Opening,"Hey {{firstName}}, this is Alex from Atomicwork. How's your day going?",true
Discovery Call,"Hi {{firstName}}, I'm Alex. I noticed {{company}} might be dealing with some IT service management challenges. Got a minute to chat?",false
Follow-up Script,"Hey {{firstName}}, it's Alex again from Atomicwork. Following up on our last conversation about {{company}}'s ITSM setup. Do you have 5 minutes?",false
```

### **Field Details:**
- **name** (required): Script name/title
- **content** (required): Script text with template variables
- **isDefault** (required): "true" or "false" - marks default script

### **Template Variables Available:**
- `{{firstName}}` - Lead's first name
- `{{lastName}}` - Lead's last name
- `{{company}}` - Lead's company name
- `{{jobTitle}}` - Lead's job title
- `{{repName}}` - SDR name (defaults to "Alex")

---

## 🔧 How to Import

### **Option 1: Using Prisma Studio (Recommended for Testing)**

1. **Start Prisma Studio:**
   ```bash
   cd app
   npx prisma studio
   ```

2. **Open in browser:** http://localhost:5555

3. **Manual Entry:**
   - Click on "Lead" or "Script" model
   - Click "Add record"
   - Fill in the fields
   - Make sure to set `userId` to your user ID

### **Option 2: Create Import API Endpoint**

I can create API endpoints for bulk CSV import:
- `/api/leads/import` - Upload leads CSV
- `/api/scripts/import` - Upload scripts CSV

### **Option 3: Direct SQL Insert (Quick Test)**

**For Leads:**
```sql
INSERT INTO "Lead" (id, "userId", "firstName", "lastName", phone, email, company, "jobTitle", "linkedinUrl", notes, status, "linkedinEnriched", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'YOUR_USER_ID', 'John', 'Smith', '+14155551234', 'john.smith@acme.com', 'Acme Corp', 'VP of Engineering', 'https://linkedin.com/in/johnsmith', 'Met at conference', 'pending', false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_USER_ID', 'Sarah', 'Johnson', '+14155555678', 'sarah.j@techco.io', 'TechCo', 'CTO', 'https://linkedin.com/in/sarahj', 'Warm lead', 'pending', false, NOW(), NOW());
```

**For Scripts:**
```sql
INSERT INTO "Script" (id, "userId", name, content, "isDefault", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'YOUR_USER_ID', 'Default Opening', 'Hey {{firstName}}, this is Alex from Atomicwork. How''s your day going?', true, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_USER_ID', 'Discovery Call', 'Hi {{firstName}}, I''m Alex. I noticed {{company}} might be dealing with some IT challenges. Got a minute?', false, NOW(), NOW());
```

---

## 🎯 Quick Test Data

### **Sample leads.csv**
```csv
firstName,lastName,phone,email,company,jobTitle,linkedinUrl,notes,status
Alex,Martinez,+14155551111,alex@techcorp.com,TechCorp,CTO,https://linkedin.com/in/alexm,High priority lead,pending
Jamie,Lee,+14155552222,jamie.lee@startup.io,StartupIO,VP Engineering,,Referral from John,pending
Taylor,Brown,+14155553333,tbrown@enterprise.com,Enterprise Co,IT Director,https://linkedin.com/in/taylorbrown,Met at conference,pending
```

### **Sample scripts.csv**
```csv
name,content,isDefault
Atomicwork Opening,"Hey {{firstName}}, this is Alex from Atomicwork. How's your day going? I know you're busy, so I'll keep this quick. We help IT teams like yours at {{company}} cut down on busywork with AI-native service management. Worth a quick chat?",true
Pain Point Discovery,"Hi {{firstName}}, Alex here. Quick question - how much time does your team at {{company}} spend on repetitive IT tickets? We've helped similar companies reduce that by 60%. Interested in learning how?",false
```

---

## 🚀 Recommended Approach

**I suggest creating a CSV import API endpoint so you can:**
1. Upload CSV files directly from the UI
2. Validate data before import
3. Handle errors gracefully
4. Auto-assign to logged-in user

**Would you like me to create the CSV import endpoints?** This would add:
- Upload form in the UI
- Backend validation
- Bulk insert with proper user association
- Error reporting

Or would you prefer to manually add test data via Prisma Studio first?
