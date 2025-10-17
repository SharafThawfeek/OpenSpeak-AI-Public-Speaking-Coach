from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv
import re

# 🌍 Load environment variables
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")

def estimate_word_count(user_input: str) -> int:
    """
    Estimate target word count based on user-specified duration.
    1 minute of speech ≈ 130 words.
    """
    match = re.search(r"(\d+)\s*(minute|min|minutes)", user_input.lower())
    if match:
        minutes = int(match.group(1))
        return minutes * 130  # convert time to word count
    return 300  # default if not specified

def create_speech_generator():
    """
    Creates a conversational AI chain that generates motivational and structured public speaking scripts.
    Uses STAR (Situation, Task, Action, Result) + speechwriting techniques.
    """

    # 🧩 Initialize Groq LLM
    llm = ChatGroq(
        groq_api_key=groq_api_key,
        model="llama-3.1-8b-instant",
        temperature=0.8  # adds creativity but keeps coherence
    )

    # 🧠 Professional System Prompt
    system_prompt = (
        "You are a world-class speechwriting assistant trained to craft inspiring, professional, and emotionally engaging speeches. "
        "Structure each speech using the STAR framework (Situation, Task, Action, Result) combined with proven storytelling principles. "
        "Include a strong opening hook, smooth transitions between ideas, and a memorable closing statement or call to action.\n\n"

        "🎯 Length Rules:\n"
        "- If the user specifies time (e.g., '5-minute' or '10-minute'), assume 1 minute ≈ 130 words.\n"
        "- If the user specifies a word count, follow that.\n"
        "- If neither is specified, default to about 250–300 words.\n"
        "- Ensure speech length roughly matches the target duration.\n\n"

        "🎤 Style Rules:\n"
        "- Write in a spoken, natural tone — short sentences and conversational flow.\n"
        "- Use light rhetorical devices (like repetition, metaphor, or contrast) to engage, but don’t overdo them.\n"
        "- Avoid robotic phrasing, formal reports, or academic tone.\n"
        "- Keep language inclusive, motivational, and emotionally intelligent.\n\n"

        "🧩 Structure:\n"
        "1. **Introduction / Hook** — capture attention and set the tone.\n"
        "2. **Situation** — describe the background or problem.\n"
        "3. **Task** — outline the goal or what needed to be done.\n"
        "4. **Action** — detail what was done or what should be done.\n"
        "5. **Result / Closing** — share the outcome or key message.\n\n"

        "🧼 Output Formatting:\n"
        "- Output only the speech text, formatted with clear sections and line breaks.\n"
        "- Do not include system messages, metadata, or code blocks.\n"
        "- Never mention token counts, models, or technical info."
    )

    # 🧩 Prompt Template
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}")
    ])

    # 🔗 Build Chain
    chain = prompt | llm

    # 🧱 In-memory chat session store
    session_store = {}

    def get_session_history(session_id: str) -> BaseChatMessageHistory:
        """Retrieve or initialize chat session history."""
        if session_id not in session_store:
            session_store[session_id] = ChatMessageHistory()
        return session_store[session_id]

    # 🗣 Wrap chain with persistent message history
    speech_chain = RunnableWithMessageHistory(
        chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer",  # must match frontend key
    )

    return speech_chain
