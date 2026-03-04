# ITSM Cold Call Playbook

## The Anatomy of a Perfect ITSM Cold Call

### 1. The Opener (Pattern Interrupt)
**Goal:** Get permission to continue (Permission-based approach)

**Format:**
```
"Hi [Name], I know I'm an interruption. Do you have 27 seconds to tell me if I should hang up?"
```

**Why it works:**
- Disarms immediate rejection
- Shows respect for their time
- Creates curiosity ("27 seconds is oddly specific")
- Gets them to commit to listening

**Variations:**
- "Hi [Name], I know this is out of the blue. Got 30 seconds to hear why I called?"
- "Hi [Name], this is cold call. Do you have 15 seconds to decide if you want to hang up?"

---

### 2. The Hook (Problem-First)

**Rule:** Don't talk about "Ticketing" or "ITSM Platform." Talk about PAIN.

**Format:**
```
"I'm talking to [ROLE] who are [SPECIFIC PAIN POINT that makes them nod]."
```

**Examples by Role:**

**IT Directors:**
- "...burning out their Tier 2 engineers on Tier 1 password resets."
- "...drowning in tickets that could be automated."
- "...paying ServiceNow enterprise prices for basic ITSM."

**CIOs:**
- "...spending 6 months implementing ITSM tools that employees hate."
- "...losing productivity to IT ticket backlogs."
- "...can't show the C-suite measurable ROI from IT investments."

**Head of IT Operations:**
- "...manually routing tickets between teams because their system doesn't."
- "...chasing SLA violations instead of strategic projects."
- "...stuck maintaining legacy portals nobody uses."

**VP of Employee Experience:**
- "...getting complaints about IT support response times."
- "...watching employees waste hours in clunky ticketing portals."
- "...can't measure employee satisfaction with IT services."

---

### 3. The Value Drivers (Top 3)

**Always lead with these 3 metrics in this order:**

#### a) Speed (MTTR - Mean Time To Resolution)
```
"We resolve 40% of tickets in under 10 seconds via AI."
```

**Supporting stats:**
- "Password resets: 8 seconds average"
- "Access requests: auto-approved in real-time based on policy"
- "Software installs: one-click deployment from Slack"

#### b) Cost (Cost Per Ticket)
```
"Stop paying $50 per ticket for simple questions."
```

**Supporting stats:**
- "Tier 1 automation saves $200K/year on average"
- "Deploy in 2 weeks, not 6 months"
- "No need for dedicated Tier 1 staff for basic requests"

#### c) Experience (Employee Satisfaction)
```
"Give employees help where they work (Slack/Teams), not a portal they hate."
```

**Supporting stats:**
- "87% of tickets resolved without leaving Slack"
- "4.8/5 employee satisfaction score"
- "70% reduction in escalations"

---

### 4. The Ask (Soft Close)

**Format:**
```
"Would you be opposed to seeing how companies like yours [OUTCOME]?"
```

**Examples:**

**For IT Directors:**
- "Would you be opposed to seeing how companies like yours cut ticket volume by half?"
- "Would you be opposed to a 15-minute demo of how we automate password resets?"

**For CIOs:**
- "Would you be opposed to seeing how similar-sized companies deployed this in 2 weeks?"
- "Would you be opposed to a business case showing 3x ROI?"

**For Heads of Operations:**
- "Would you be opposed to seeing how we route tickets automatically across teams?"

**Why "opposed" works:**
- Softens the ask psychologically
- Makes "no" feel like they're actively rejecting help
- Creates cognitive dissonance if they have the problem you described

---

## Full Script Example

**Lead:** Nik Adroja, IT Infrastructure Director @ iNova Pharmaceuticals

### Script:

**Opener:**
> "Hi Nik, I know I'm an interruption. Do you have 27 seconds to tell me if I should hang up?"

**[Wait for response - "Sure" or "What is this about?"]**

**Hook:**
> "I'm talking to IT leaders in pharma who are burning out their senior engineers on Tier 1 password resets and access requests. Does that sound familiar?"

**[Wait for acknowledgment]**

**Value Drivers:**
> "Here's why I called: We're helping companies like yours:
> 1. Resolve 40% of tickets in under 10 seconds with AI
> 2. Cut support costs from $50/ticket down to under $5
> 3. Give employees help in Slack instead of forcing them into ServiceNow
>
> One pharma company similar to iNova cut their ticket backlog by 60% in the first month."

**The Ask:**
> "Would you be opposed to seeing how they did it? I can send over a 2-minute walkthrough video, or we can do a quick 15-minute call this week. Which would you prefer?"

---

## Key Principles

### DO:
✅ Start with permission ("27 seconds")
✅ Lead with pain, not product
✅ Use specific, believable metrics (40%, $50/ticket)
✅ Name-drop relevant industries ("pharma companies like yours")
✅ Soft close with "opposed to"
✅ Give them an easy out (video vs call)

### DON'T:
❌ Say "ITSM platform" or "ticketing system" in opener
❌ Lead with company name ("This is Alex from Atomicwork...")
❌ Ask "How are you?" (waste of time)
❌ Pitch features before establishing pain
❌ Hard close ("Can I get 30 minutes on your calendar?")
❌ Talk about "AI-powered" or buzzwords upfront

---

## Objection Handling

### "We already have ServiceNow/Jira"
> "That's exactly why I called. Most of our customers had ServiceNow. The problem isn't the platform—it's that employees hate using portals. We work alongside ServiceNow. Think of us as the front door that employees actually like."

### "We're not looking right now"
> "Totally fair. Most IT leaders I talk to aren't actively shopping. But if I could show you how to cut your Tier 1 workload in half in 15 minutes, would that be worth a look?"

### "Send me some information"
> "Happy to. But honestly, the best way to see this is a 2-minute demo. How about I send you a video you can watch at your desk, and if it looks interesting, we can chat? Fair?"

### "We don't have budget"
> "I hear you. Most teams don't have ITSM budget sitting around. But if you're spending $200K/year on Tier 1 support, and we can cut that by half, the ROI case becomes pretty clear. Want to see the numbers?"

### "Call me next quarter"
> "No problem. Before I go—are you dealing with [PAIN POINT from Hook]? Just want to make sure this is even worth following up on."

---

## Success Metrics

**Good Call:**
- ✅ Got past 27 seconds
- ✅ They acknowledged the pain point
- ✅ They asked a question
- ✅ Agreed to next step (video, demo, email)

**Great Call:**
- ✅ All of the above +
- ✅ They mentioned specific pain ("Yes, password resets are killing us!")
- ✅ They asked about pricing or timeline
- ✅ Committed to a specific date/time for follow-up

---

## Implementation in AI-SDR

### Script Generation
Generate scripts following this exact structure:

```json
{
  "opener": {
    "patternInterrupt": "Hi [Name], I know I'm an interruption...",
    "permission": "Do you have 27 seconds to tell me if I should hang up?"
  },
  "hook": {
    "problemStatement": "I'm talking to [ROLE] who are [PAIN]",
    "confirmPain": "Does that sound familiar?"
  },
  "valueDrivers": {
    "speed": "We resolve 40% of tickets in <10 seconds",
    "cost": "Cut costs from $50/ticket to $5",
    "experience": "Help in Slack, not portals",
    "socialProof": "One pharma company cut backlog by 60%"
  },
  "ask": {
    "softClose": "Would you be opposed to seeing how they did it?",
    "options": ["2-min video", "15-min call this week"]
  }
}
```

### AI Voice Instructions
Update `realtimeVoiceServer.js` to enforce:
1. ALWAYS start with permission-based opener
2. NEVER pitch product before confirming pain
3. State all 3 value drivers (Speed, Cost, Experience)
4. Use "opposed to" language for soft close

---

## Training Scenarios

### Scenario 1: The Busy Gatekeeper
**You:** "Hi, is this Nik?"
**Lead:** "Yeah, who's this?"
**You:** "I know I'm interrupting. Got 27 seconds?"
**Lead:** "Make it quick."
**You:** "Are you burning out engineers on password resets?"
**Lead:** "Every day."
**You:** [Launch into value drivers]

### Scenario 2: The Skeptic
**You:** "Would you be opposed to seeing how we cut ticket volume by half?"
**Lead:** "We've tried AI ticketing. Doesn't work."
**You:** "I hear you. Most chatbots don't. But we're not a chatbot—we actually resolve issues, not just deflect. Can I show you the difference in 2 minutes?"

---

## Next Steps

1. Update `scriptGeneration.js` to use ITSM Playbook structure
2. Update `realtimeVoiceServer.js` AI instructions
3. Test with real calls
4. Measure: % getting past opener, % acknowledging pain, % booking next step

---

**Remember:** The goal isn't to sell on the first call. It's to get permission to continue the conversation.
