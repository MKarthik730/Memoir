from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import os
import shutil

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploaded_docs"
VECTOR_DB_FOLDER = "vector_db"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

vector_store = None

class ChatRequest(BaseModel):
    message: str

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global vector_store

   
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

   
    if file.filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)

    documents = loader.load()

    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)

    
    vector_store = Chroma.from_documents(
        chunks,
        embeddings,
        persist_directory=VECTOR_DB_FOLDER
    )

    return {"message": f"File '{file.filename}' uploaded and indexed! {len(chunks)} chunks created."}

@app.post("/chat")
def chat(request: ChatRequest):
    if vector_store:
        
        relevant_docs = vector_store.similarity_search(request.message, k=3)
        context = "\n".join([doc.page_content for doc in relevant_docs])
        source_note = "From your uploaded documents"
    else:
        context = "No documents uploaded yet."
        source_note = "No document context"

    system_prompt = f"""You are a helpful assistant.
Use the following content to answer the user's question.

{source_note}:
{context}

IMPORTANT INSTRUCTIONS:
- Answer in simple short points, one at a time
- Each point should be 1-2 sentences only
- Use numbered points like 1. 2. 3.
- Keep each point clear and easy to understand
- Do not dump everything at once"""

    response = ollama.chat(
        model="llama3.2:1b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message},
        ],
        options={"num_predict": 150, "num_thread": 8}
    )
    return {"response": response["message"]["content"]}