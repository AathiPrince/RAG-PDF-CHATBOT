import os
import shutil
import traceback
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

app = FastAPI(title="RAG Application API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

LLM_MODEL = "qwen2.5:1.5b"
global_vectorstore = None
EMBEDDING_MODEL = "nomic-embed-text"
OLLAMA_URL = "http://localhost:11434"

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = [] 

@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    global global_vectorstore
    try:
        documents = []
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            

            loader = PyPDFLoader(file_path)
            documents.extend(loader.load())
            
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        print(f"Generated {len(chunks)} chunks from the uploaded PDF(s).")
        
        
        print(f"Initializing local embeddings with model: {EMBEDDING_MODEL}...")
        embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=OLLAMA_URL)
        
        print(f"Starting embedding generation and Chroma DB persistence for {len(chunks)} chunks...")
        print("NOTE: This may take several minutes if the PDF is large and is running on CPU.")
        global_vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings
        )
        print("Successfully created embeddings in memory!")
        
        return {"message": f"Successfully processed {len(files)} files into {len(chunks)} chunks."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear")
async def clear_db():
    global global_vectorstore
    try:
        global_vectorstore = None
            
        if os.path.exists(UPLOAD_DIR):
            shutil.rmtree(UPLOAD_DIR)
            os.makedirs(UPLOAD_DIR, exist_ok=True)
        return {"message": "Knowledge base successfully cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    global global_vectorstore
    try:
        if global_vectorstore is None:
             raise HTTPException(status_code=400, detail="Please upload a document first.")
        
        retriever = global_vectorstore.as_retriever(search_kwargs={"k": 4})
        
        llm = Ollama(model=LLM_MODEL, base_url=OLLAMA_URL)
        
        prompt_template = """
        Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Use three sentences maximum and keep the answer concise.

        Context: {context}

        Question: {question}

        Answer:
        """
        prompt = PromptTemplate.from_template(prompt_template)
        
        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)
            
        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
        
        response = rag_chain.invoke(request.message)
        
        return {"response": response}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
