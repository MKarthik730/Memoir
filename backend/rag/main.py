from rag_model import RAGModel

def main():
    rag = RAGModel()
    
    documents = [
        "Python is a high-level programming language known for its simplicity and readability.",
        "Machine learning is a subset of artificial intelligence that focuses on data-driven algorithms.",
        "Natural language processing enables computers to understand and generate human language.",
        "Vector databases store embeddings and enable semantic search capabilities.",
        "Transformers revolutionized NLP with self-attention mechanisms.",
        "Deep learning uses neural networks with multiple layers to learn complex patterns.",
        "RAG combines retrieval and generation for better question answering.",
        "FAISS is a library for efficient similarity search and clustering of dense vectors."
    ]
    
    rag.add_documents(documents)
    
    question = "What is machine learning?"
    result = rag.query(question, top_k=3)
    
    print("\n" + "="*60)
    print(f"Question: {question}")
    print("="*60)
    print("\nRetrieved Documents:")
    for i, doc in enumerate(result['retrieved_documents'], 1):
        print(f"{i}. {doc.text}")
    
    print("\n" + "="*60)
    print("Generated Prompt:")
    print("="*60)
    print(result['prompt'])

if __name__ == "__main__":
    main()
