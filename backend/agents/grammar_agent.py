import os, re, json
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

def analyze_grammar(text: str):
    prompt = f"""
    You are a language expert.
    Analyze the **LANGUAGE QUALITY** of this speech.
    Focus on:
    - Grammar errors
    - Vocabulary variety
    - Sentence fluency
    - Improvement tips

    Respond STRICTLY in JSON format:
    {{
      "summary": "One-sentence overview",
      "strengths": ["Short bullet points"],
      "weaknesses": ["Short bullet points"],
      "score": 1–10
    }}

    Speech:
    \"\"\"{text}\"\"\"
    """

    response = llm.invoke([SystemMessage(content="Return clean JSON only."), HumanMessage(content=prompt)])
    output = re.sub(r"<think>.*?</think>", "", response.content, flags=re.DOTALL)

    match = re.search(r"\{.*\}", output, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return {
        "summary": "Grammar analysis unavailable.",
        "strengths": [],
        "weaknesses": [],
        "score": 0
    }
