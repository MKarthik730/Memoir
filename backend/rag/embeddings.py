import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List

class EmbeddingModel:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.encoder = SentenceTransformer(model_name)
        self.dimension = self.encoder.get_sentence_embedding_dimension()
    
    def encode(self, texts: List[str]) -> np.ndarray:
        return self.encoder.encode(texts, convert_to_numpy=True)
    
    def get_dimension(self) -> int:
        return self.dimension
