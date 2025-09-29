from flask import Flask, request, jsonify
import pdfplumber
import re
from groq import Groq
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Fetch API key from environment
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("GROQ_API_KEY not found in .env file")

client = Groq(api_key=groq_api_key)

def extract_text_from_pdf(uploaded_file):
    """Extract full text from multi-page PDF."""
    text = ""
    with pdfplumber.open(uploaded_file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def chunk_text(text, chunk_size=2000):
    """Split large text into smaller chunks."""
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

def summarize_text(text, role="resume"):
    """Summarize large text into <300 words using smaller model."""
    chunks = chunk_text(text)
    summaries = []
    for chunk in chunks:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[
                {"role": "system", "content": f"Summarize this {role} text in under 200 words. Focus on key skills, achievements, and qualifications."},
                {"role": "user", "content": chunk}
            ]
        )
        summaries.append(response.choices[0].message.content)
    return " ".join(summaries)

def extract_keywords(text):
    """Extract simple keywords (nouns/tech terms) from text."""
    keywords = re.findall(r"\b[A-Z][a-zA-Z0-9#+]*\b", text)
    return set(keywords)

def highlight_missing_keywords(resume_summary, job_summary):
    """Highlight missing keywords from resume vs job description."""
    job_keywords = extract_keywords(job_summary)
    resume_keywords = extract_keywords(resume_summary)
    missing = job_keywords - resume_keywords
    return missing

def score_resume(resume_summary, job_summary):
    """Compare resume vs job description and give ATS score + feedback."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  
        messages=[
            {"role": "system", "content": "You are an expert ATS evaluator."},
            {"role": "user", "content": f"""
Resume Summary:
{resume_summary}

Job Description Summary:
{job_summary}

Task:
1. Give an ATS match percentage (0-100).
2. Highlight strengths and weaknesses. Use markdown bolding (e.g., **word**) to emphasize only the most critical keywords or phrases. Be selective with bolding.
3. Suggest improvements for better match.
"""}
        ]
    )
    
    match = re.search(r"(\d{1,3})\s*%", response.choices[0].message.content)
    percentage = int(match.group(1)) if match else 0
    return response.choices[0].message.content, percentage

@app.route('/score', methods=['POST'])
def score():
    data = request.get_json()
    job_desc = data.get('job_desc')
    resume_text = data.get('resume_text')

    if not resume_text or not job_desc:
        return jsonify({'error': 'Please provide both Job Description and Resume.'}), 400

    resume_summary = summarize_text(resume_text, role="resume")
    job_summary = summarize_text(job_desc, role="job description")
    ats_result, match_percentage = score_resume(resume_summary, job_summary)
    missing_keywords = highlight_missing_keywords(resume_summary, job_summary)

    return jsonify({
        'ats_result': ats_result,
        'match_percentage': match_percentage,
        'missing_keywords': list(missing_keywords)
    })

if __name__ == '__main__':
    app.run(debug=True)
