import json
import os
import re

import groq
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DiagnoseRequest(BaseModel):
    error_message: str
    stack_trace: str = ""
    language: str = "Python"


@app.post("/diagnose")
def diagnose(request: DiagnoseRequest):
    if not request.error_message or not request.error_message.strip():
        return JSONResponse(status_code=400, content={"error": "Error message is required"})

    groq_api_key = os.getenv("GROQ_API_KEY")
    client = groq.Groq(api_key=groq_api_key)

    system_prompt = """You are an expert debugging assistant. Given an error message and stack trace, return ONLY a valid JSON object with exactly these fields:
  {
    severity: string (exactly one of: Critical, Warning, Minor),
    what_broke: string (plain English explanation of what broke, 2-3 sentences),
    exact_fix: string (the exact code fix with explanation, 3-5 sentences),
    prevention: string (how to prevent this in future, 2-3 sentences)
  }
  Return only the JSON object. No markdown, no explanation, no extra text."""

    user_message = (
        f"Language: {request.language}\n"
        f"Error: {request.error_message}\n"
        f"Stack trace: {request.stack_trace}"
    )

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        content = completion.choices[0].message.content or ""
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Groq API failed"})

    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        return JSONResponse(status_code=500, content={"error": "Failed to parse AI response"})

    try:
        parsed_response = json.loads(match.group(0))
    except (json.JSONDecodeError, TypeError):
        return JSONResponse(status_code=500, content={"error": "Failed to parse AI response"})

    return parsed_response


@app.get("/health")
def health():
    return {"status": "ok"}
