# BugReport 🐛

> Paste any error. Get the exact fix in seconds.

No more Stack Overflow rabbit holes. No more guessing.
BugReport reads your error, understands your stack trace, and tells you exactly what broke and how to fix it.

![demo](demo.gif)

---

## The Problem
```
You write code.
You get an error.
You copy it to Google.
You open 47 Stack Overflow tabs.
30 minutes later you still don't know what broke.
```

**BugReport solves this in under 10 seconds.**

---

## What You Get

Paste any error message → get a complete diagnosis card:

| Section | What it tells you |
|---------|------------------|
| 🔴 Severity | Critical / Warning / Minor |
| 🔍 What Broke | Plain English explanation of the root cause |
| ⚙️ Exact Fix | Code fix with full explanation |
| 🛡️ Prevention | How to never hit this error again |

---

## How It Works
```
┌─────────────────────────────────────────────────────┐
│                    USER                             │
│  Pastes error message + stack trace + language      │
└─────────────────────┬───────────────────────────────┘
                      │ POST /diagnose
                      ▼
┌─────────────────────────────────────────────────────┐
│              Next.js Frontend                       │
│  Sends request to Python FastAPI backend            │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP POST localhost:8000
                      ▼
┌─────────────────────────────────────────────────────┐
│           Python FastAPI Backend                    │
│  Validates input → Builds structured prompt         │
└─────────────────────┬───────────────────────────────┘
                      │ API call
                      ▼
┌─────────────────────────────────────────────────────┐
│         Groq API (llama-3.1-8b-instant)             │
│  Returns structured JSON diagnosis                  │
└─────────────────────┬───────────────────────────────┘
                      │ JSON response
                      ▼
┌─────────────────────────────────────────────────────┐
│              Result Card                            │
│  Severity + What Broke + Exact Fix + Prevention     │
└─────────────────────────────────────────────────────┘
```

---

## Supported Languages

| Language | Status |
|----------|--------|
| Python | ✅ Supported |
| JavaScript | ✅ Supported |
| TypeScript | ✅ Supported |
| Java | ✅ Supported |
| Go | ✅ Supported |
| Rust | ✅ Supported |

---

## Severity Levels
```
🔴 CRITICAL
   App crashes, data loss risk, security vulnerability
   Must fix immediately

🟡 WARNING  
   Unexpected behavior, performance issue
   Fix soon

🟢 MINOR
   Style issue, deprecation warning
   Fix when convenient
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 + TypeScript | UI and user interaction |
| Styling | Tailwind CSS | Dark developer aesthetic |
| Backend | Python FastAPI | AI logic and API handling |
| Server | Uvicorn | Python ASGI server |
| AI Model | llama-3.1-8b-instant | Error diagnosis via Groq |
| API | Groq API | Fast LLM inference |

---

## Project Structure
```
BugReport/
├── app/
│   ├── page.tsx              ← Main UI — input form + result card
│   ├── layout.tsx
│   └── globals.css
├── bugreport-api/
│   ├── main.py               ← FastAPI app + /diagnose endpoint
│   ├── requirements.txt      ← Python dependencies
│   └── .env                  ← GROQ_API_KEY
├── public/
├── .env.local
└── README.md
```

---

## API Reference

### POST `/diagnose`

**Request:**
```json
{
  "error_message": "NameError: name 'x' is not defined",
  "stack_trace": "File main.py line 14 in calculate",
  "language": "Python"
}
```

**Response:**
```json
{
  "severity": "Critical",
  "what_broke": "You are trying to use variable x before declaring it...",
  "exact_fix": "Declare x before using it. Add x = 0 before line 14...",
  "prevention": "Always initialize variables before using them..."
}
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| 400 | Error message is empty |
| 500 | Groq API failed |
| 500 | Failed to parse AI response |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Groq API key — free at console.groq.com

### Installation
```bash
git clone https://github.com/avikcodes/BugReport
cd BugReport
```

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd bugreport-api
pip install -r requirements.txt
```

### Setup
```bash
# In bugreport-api/.env
GROQ_API_KEY=your_key_here
```

### Run

**Terminal 1 — Backend:**
```bash
cd bugreport-api
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open `http://localhost:3000`

---

## Example Diagnoses

**Python NameError:**
```
Input:  NameError: name 'x' is not defined
Output: 🔴 Critical
        What Broke: Variable x is being used before assignment on line 14
        Exact Fix:  Add x = None or x = 0 before the function call
        Prevention: Always initialize variables at the top of their scope
```

**JavaScript TypeError:**
```
Input:  TypeError: Cannot read properties of undefined (reading 'map')
Output: 🔴 Critical  
        What Broke: You are calling .map() on a variable that is undefined
        Exact Fix:  Add a null check — use data?.map() or if(data) before mapping
        Prevention: Always validate API responses before accessing properties
```

---

## Roadmap

- [x] Python, JS, TS, Java, Go, Rust support
- [x] Severity classification
- [x] Copy fix to clipboard
- [ ] VS Code extension
- [ ] GitHub Actions integration
- [ ] Slack bot — post errors directly
- [ ] Fix history saved to Supabase

---

## Part of 30 Projects

This is **Project 3 of 30** in my open-source build sprint.

Building 30 open-source AI tools for developers and researchers — March to December 2026.

→ Follow on X: [@Avik12345678](https://x.com/Avik12345678)

→ All projects: [github.com/avikcodes](https://github.com/avikcodes)

---

## License

MIT — free to use, modify, and distribute.
