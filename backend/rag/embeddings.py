import hashlib
import numpy as np
from typing import List

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None

class EmbeddingModel:
    def __init__(self, model_name: str = 'all-mpnet-base-v2'):
        self.model_name = model_name
        self.encoder = None
        self.dimension = 384

        if SentenceTransformer is not None:
            try:
                self.encoder = SentenceTransformer(model_name)
                self.dimension = self.encoder.get_sentence_embedding_dimension()
            except Exception:
                self.encoder = None
                self.dimension = 384

    def _fallback_encode(self, texts: List[str]) -> np.ndarray:
        vectors = np.zeros((len(texts), self.dimension), dtype=np.float32)
        for row, text in enumerate(texts):
            for token in (text or "").lower().split():
                digest = hashlib.sha256(token.encode("utf-8", errors="ignore")).digest()
                idx = int.from_bytes(digest[:4], byteorder="little") % self.dimension
                vectors[row, idx] += 1.0

            norm = np.linalg.norm(vectors[row])
            if norm > 0:
                vectors[row] /= norm
        return vectors
    
    def encode(self, texts: List[str]) -> np.ndarray:
        if self.encoder is not None:
            return self.encoder.encode(texts, convert_to_numpy=True)
        return self._fallback_encode(texts)
    
    def get_dimension(self) -> int:
        return self.dimension
