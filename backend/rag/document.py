from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class Document:
    id: int
    text: str
    metadata: Optional[Dict] = None
