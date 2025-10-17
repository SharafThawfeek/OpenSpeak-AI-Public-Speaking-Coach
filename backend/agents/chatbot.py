from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.document_loaders.text import TextLoader
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_groq import ChatGroq
from langchain.chains import create_retrieval_chain, create_history_aware_retriever
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_huggingface import HuggingFaceEmbeddings
import os
from dotenv import load_dotenv
import logging

load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
os.environ["HF_TOKEN"] = os.getenv("HF_TOKEN", "")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def create_chatbot():
    """Create the OpenSpeak AI Coach Chatbot with contextual memory and retrieval."""
    # Choose a supported Groq model
    # Replace this string if it’s invalid in your Groq account
    model_id = "llama-3.1-8b-instant"
    # Fallback model if groq fails (e.g. HF)
    fallback_model = "gpt-3.5-turbo"

    # Initialize Groq LLM
    llm = ChatGroq(
        groq_api_key=groq_api_key,
        model=model_id,
        temperature=0.3,
    )

    # Load context.txt
    context_path = os.path.join(os.path.dirname(__file__), "context.txt")
    if not os.path.exists(context_path):
        logger.error("context.txt not found at %s", context_path)
        docs = []
    else:
        loader = TextLoader(context_path, encoding="utf-8")
        try:
            docs = loader.load()
        except Exception as e:
            logger.error("Failed to load context.txt: %s", e)
            docs = []

    # Split docs
    if docs:
        splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=200)
        splits = splitter.split_documents(docs)
    else:
        splits = []

    # Create embeddings
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Create or persist vector DB
    vector_db = Chroma.from_documents(
        embedding=embeddings,
        documents=splits,
        collection_name="openspeak-chatbot",
        persist_directory="./.chroma_chatbot"
    )

    retriever = vector_db.as_retriever(search_kwargs={"k": 4})

    # Prompt to reformulate follow-up questions
    reformulate_prompt = (
        "You are given the chat history and the latest user input. "
        "Rewrite the input into a clear, standalone question, without answering it. "
        "Do not include context or references to the conversation."
    )
    ref_prompt = ChatPromptTemplate.from_messages([
        ("system", reformulate_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
    ])

    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, ref_prompt
    )

    # System prompt for the chatbot
    system_prompt = (
        "You are OpenSpeak — a professional AI speaking coach and assistant. "
        "You help users with public speaking, voice analysis, grammar feedback, and usage guidance. "
        "Use the retrieved knowledge below to answer clearly and helpfully. "
        "Do not mention that you used retrieved context. "
        "If unclear, ask for clarification. "
        "End with a helpful tip or encouragement.\n\n"
        "{context}"
    )
    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])

    doc_chain = create_stuff_documents_chain(llm, qa_prompt)
    rag_chain = create_retrieval_chain(history_aware_retriever, doc_chain)

    # Session memory
    session_store: dict[str, ChatMessageHistory] = {}

    def get_session_history(session_id: str) -> BaseChatMessageHistory:
        if session_id not in session_store:
            session_store[session_id] = ChatMessageHistory()
        return session_store[session_id]

    # Runnable with message history
    conversational_chain = RunnableWithMessageHistory(
        rag_chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer",
    )

    logger.info("Chatbot initialized with Groq model %s", model_id)
    return conversational_chain
