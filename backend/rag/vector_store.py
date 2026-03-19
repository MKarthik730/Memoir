import numpy as np
from typing import Tuple

try:
    import faiss
except Exception:
    faiss = None

class VectorStore:
    def __init__(self, dimension: int):
        self.dimension = dimension
        self._memory = np.empty((0, dimension), dtype=np.float32)
        self.index = faiss.IndexFlatL2(dimension) if faiss is not None else None
    
    def add(self, embeddings: np.ndarray):
        emb = embeddings.astype('float32')
        if self.index is not None:
            self.index.add(emb)
        else:
            self._memory = np.vstack([self._memory, emb])
    
    def search(self, query_embedding: np.ndarray, top_k: int) -> Tuple[np.ndarray, np.ndarray]:
        q = query_embedding.astype('float32')
        if self.index is not None:
            return self.index.search(q, top_k)

        if self._memory.shape[0] == 0:
            return np.array([[]], dtype=np.float32), np.array([[]], dtype=np.int64)

        distances = []
        indices = []
        for query_vec in q:
            dists = np.linalg.norm(self._memory - query_vec, axis=1)
            order = np.argsort(dists)[:top_k]
            distances.append(dists[order])
            indices.append(order)

        return np.array(distances, dtype=np.float32), np.array(indices, dtype=np.int64)
    
    def save(self, path: str):
        if self.index is not None and faiss is not None:
            faiss.write_index(self.index, f"{path}.index")
        else:
            np.save(f"{path}.npy", self._memory)
    
    def load(self, path: str):
        if faiss is not None:
            self.index = faiss.read_index(f"{path}.index")
            self._memory = np.empty((0, self.dimension), dtype=np.float32)
        else:
            self._memory = np.load(f"{path}.npy")
            self.index = None
    
    def size(self) -> int:
        if self.index is not None:
            return self.index.ntotal
        return self._memory.shape[0]
