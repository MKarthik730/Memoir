import faiss
import numpy as np
from typing import List, Tuple

class VectorStore:
    def __init__(self, dimension: int):
        self.dimension = dimension
        self.index = faiss.IndexFlatL2(dimension)
    
    def add(self, embeddings: np.ndarray):
        self.index.add(embeddings.astype('float32'))
    
    def search(self, query_embedding: np.ndarray, top_k: int) -> Tuple[np.ndarray, np.ndarray]:
        return self.index.search(query_embedding.astype('float32'), top_k)
    
    def save(self, path: str):
        faiss.write_index(self.index, f"{path}.index")
    
    def load(self, path: str):
        self.index = faiss.read_index(f"{path}.index")
    
    def size(self) -> int:
        return self.index.ntotal
