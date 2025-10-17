import os
import re
import json
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage

load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")

llm = ChatGroq(
    api_key=groq_api_key,
    model="qwen/qwen3-32b",
    temperature=0.2
)

def analyze_content(text: str):
    prompt = f"""
    You are an expert public speaking coach.
    Analyze only the **CONTENT** of this speech briefly and clearly.
    Focus on:
    - Main ideas
    - Supporting examples
    - Structure
    - Clarity

    Respond STRICTLY in clean JSON like this:
    {{
      "summary": "One-sentence overview",
      "strengths": ["Point form strengths"],
      "weaknesses": ["Point form weaknesses"],
      "score": 1–10
    }}

    Speech:
    \"\"\"{text}\"\"\"
    """

    response = llm.invoke([SystemMessage(content="Return clean JSON, no explanations."),
                           HumanMessage(content=prompt)])
    output = response.content.strip()
    output = re.sub(r"<think>.*?</think>", "", output, flags=re.DOTALL)

    match = re.search(r"\{.*\}", output, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return {
        "summary": "Content analysis unavailable.",
        "strengths": [],
        "weaknesses": [],
        "score": 0
    }
