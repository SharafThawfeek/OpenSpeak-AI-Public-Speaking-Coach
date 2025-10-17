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

def analyze_delivery(text: str):
    prompt = f"""
    You are a public speaking coach.
    Analyze the **DELIVERY** of this speech briefly and clearly.
    Focus on:
    - Tone & energy
    - Pace & pauses
    - Confidence & body language (assume normal)
    - Audience engagement

    Respond STRICTLY in clean JSON:
    {{
      "summary": "One-sentence overview",
      "strengths": ["Point form strengths"],
      "weaknesses": ["Point form weaknesses"],
      "score": 1–10
    }}

    Speech:
    \"\"\"{text}\"\"\"
    """

    response = llm.invoke([SystemMessage(content="Return only clean JSON."), HumanMessage(content=prompt)])
    output = re.sub(r"<think>.*?</think>", "", response.content, flags=re.DOTALL)

    match = re.search(r"\{.*\}", output, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return {
        "summary": "Delivery analysis unavailable.",
        "strengths": [],
        "weaknesses": [],
        "score": 0
    }
