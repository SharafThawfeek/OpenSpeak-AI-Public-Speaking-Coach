from agents.content_agent import analyze_content
from agents.delivery_agent import analyze_delivery
from agents.grammar_agent import analyze_grammar

def orchestrate_analysis(transcript: str) -> dict:
    # Run analyses
    content = analyze_content(transcript)
    delivery = analyze_delivery(transcript)
    grammar = analyze_grammar(transcript)

    # Build clean structured feedback
    feedback = {
        "content": content,
        "delivery": delivery,
        "grammar": grammar,
        "overall": {
            "summary": "Balanced overall performance with room for improvement.",
            "score": round((content["score"] + delivery["score"] + grammar["score"]) / 3, 1)
        },
        "suggestions": list(set(
            content.get("weaknesses", []) +
            delivery.get("weaknesses", []) +
            grammar.get("weaknesses", [])
        ))
    }

    return feedback
