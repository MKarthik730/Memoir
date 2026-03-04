from typing import List, Dict
from document import Document
from embeddings import EmbeddingModel
from vector_store import VectorStore

class RAGModel:
    def __init__(self, embedding_model: str = 'all-MiniLM-L6-v2'):
        self.embedding_model = EmbeddingModel(embedding_model)
        self.vector_store = VectorStore(self.embedding_model.get_dimension())
        self.documents: List[Document] = []
    
    def add_documents(self, texts: List[str], metadatas: List[Dict] = None):
        if metadatas is None:
            metadatas = [{}] * len(texts)
        
        start_id = len(self.documents)
        for i, (text, metadata) in enumerate(zip(texts, metadatas)):
            doc = Document(id=start_id + i, text=text, metadata=metadata)
            self.documents.append(doc)
        
        embeddings = self.embedding_model.encode(texts)
        self.vector_store.add(embeddings)
        
        print(f"Added {len(texts)} documents. Total: {len(self.documents)}")
    
    def retrieve(self, query: str, top_k: int = 3) -> List[Document]:
        query_embedding = self.embedding_model.encode([query])
        distances, indices = self.vector_store.search(query_embedding, top_k)
        retrieved_docs = [self.documents[idx] for idx in indices[0]]
        return retrieved_docs
    
    def generate_prompt(self, query: str, retrieved_docs: List[Document]) -> str:
        context = "\n\n".join([
            f"Document {i+1}:\n{doc.text}" 
            for i, doc in enumerate(retrieved_docs)
        ])
        
        prompt = f"""Based on the following context, answer the question.

Context:
{context}

Question: {query}

Answer:"""
        
        return prompt
    
    def query(self, question: str, top_k: int = 3) -> Dict:
        retrieved_docs = self.retrieve(question, top_k=top_k)
        prompt = self.generate_prompt(question, retrieved_docs)
        
        return {
            'retrieved_documents': retrieved_docs,
            'prompt': prompt,
            'sources': [doc.metadata for doc in retrieved_docs]
        }
    
    def save_index(self, path: str):
        self.vector_store.save(path)
    
    def load_index(self, path: str):
        self.vector_store.load(path)
