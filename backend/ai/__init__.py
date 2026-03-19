import re
import threading
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

try:
    from transformers import pipeline

    TRANSFORMERS_AVAILABLE = True
except Exception:
    TRANSFORMERS_AVAILABLE = False

try:
    import ollama

    OLLAMA_AVAILABLE = True
except Exception:
    OLLAMA_AVAILABLE = False

EMOTION_COLORS = {
    "happy": "#4CAF50",
    "joyful": "#8BC34A",
    "excited": "#FF9800",
    "grateful": "#00BCD4",
    "nostalgic": "#9C27B0",
    "sad": "#3F51B5",
    "angry": "#F44336",
    "anxious": "#FFC107",
    "fearful": "#795548",
    "disgusted": "#607D8B",
    "neutral": "#9E9E9E",
    "peaceful": "#E91E63",
    "proud": "#FF5722",
    "loving": "#E91E63",
    "difficult": "#D32F2F",
    "bittersweet": "#8E24AA",
}


@dataclass
class EmotionResult:
    emotion: str
    confidence: float
    color: str


class SentimentAnalyzer:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.classifier = None

        if TRANSFORMERS_AVAILABLE:
            try:
                self.classifier = pipeline(
                    "text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base",
                    top_k=None,
                )
            except Exception:
                self.classifier = None

    def _rule_based_analysis(self, text: str) -> Tuple[str, float]:
        text_lower = text.lower()

        emotion_keywords = {
            "happy": [
                "happy",
                "joy",
                "glad",
                "delighted",
                "cheerful",
                "wonderful",
                "great",
                "amazing",
                "fantastic",
                "love this",
                "best",
                "excited",
                "thrilled",
                "fun",
                "enjoyed",
                "awesome",
                "excellent",
            ],
            "joyful": [
                "joy",
                "overjoyed",
                "ecstatic",
                "elated",
                "blissful",
                "euphoric",
                "celebrating",
                "party",
                "congratulations",
            ],
            "excited": [
                "excited",
                "cant wait",
                "can't wait",
                "looking forward",
                "pumped",
                "hyped",
                "stoked",
                "thrilled",
            ],
            "grateful": [
                "grateful",
                "thankful",
                "appreciate",
                "blessed",
                "fortunate",
                "thank god",
                "thanks to",
            ],
            "nostalgic": [
                "remember",
                "used to",
                "back then",
                "when i was",
                "good old days",
                "miss those",
                "reminiscing",
                "nostalgia",
                "flashback",
                "throwback",
            ],
            "sad": [
                "sad",
                "unhappy",
                "depressed",
                "down",
                "crying",
                "tears",
                "heartbroken",
                "grief",
                "mourning",
                "lost",
                "passed away",
                "miss",
                "gone",
                "alone",
            ],
            "angry": [
                "angry",
                "mad",
                "furious",
                "frustrated",
                "annoyed",
                "irritated",
                "hate",
                "rage",
                "outraged",
            ],
            "anxious": [
                "anxious",
                "worried",
                "nervous",
                "stressed",
                "panic",
                "fear",
                "scared",
                "dread",
                "uncertain",
            ],
            "fearful": [
                "scared",
                "afraid",
                "terrified",
                "horrified",
                "shocked",
                "apprehensive",
            ],
            "disgusted": [
                "disgusted",
                "revolted",
                "sickened",
                "gross",
                "repulsed",
                "yuck",
                "eww",
            ],
            "peaceful": [
                "peaceful",
                "calm",
                "relaxed",
                "serene",
                "tranquil",
                "zen",
                "meditation",
                "content",
                "satisfied",
            ],
            "proud": [
                "proud",
                "accomplished",
                "achieved",
                "success",
                "won",
                "conquered",
                "nailed it",
            ],
            "loving": [
                "love",
                "adore",
                "cherish",
                "care for",
                "affection",
                "fond",
                "dear",
                "special",
                "birthday",
            ],
            "difficult": [
                "hard",
                "difficult",
                "struggle",
                "challenging",
                "tough",
                "painful",
                "suffering",
                "problem",
                "issue",
                "failed",
                "wrong",
            ],
            "bittersweet": [
                "bittersweet",
                "mixed feelings",
                "sad but",
                "happy yet",
                "although",
                "though",
            ],
        }

        scores = {}
        for emotion, keywords in emotion_keywords.items():
            count = sum(1 for keyword in keywords if keyword in text_lower)
            if count > 0:
                scores[emotion] = count

        if not scores:
            return "neutral", 0.5

        total = sum(scores.values())
        top_emotion = max(scores, key=scores.get)
        confidence = scores[top_emotion] / total

        confidence = min(0.95, 0.4 + (confidence * 0.5))

        return top_emotion, confidence

    def analyze(self, text: str) -> EmotionResult:
        if self.classifier:
            try:
                results = self.classifier(text)
                if results and len(results) > 0:
                    emotions = results[0] if isinstance(results[0], list) else results
                    top_emotion = max(emotions, key=lambda x: x["score"])
                    return EmotionResult(
                        emotion=top_emotion["label"].lower(),
                        confidence=top_emotion["score"],
                        color=EMOTION_COLORS.get(
                            top_emotion["label"].lower(), EMOTION_COLORS["neutral"]
                        ),
                    )
            except Exception:
                pass

        emotion, confidence = self._rule_based_analysis(text)
        return EmotionResult(
            emotion=emotion,
            confidence=confidence,
            color=EMOTION_COLORS.get(emotion, EMOTION_COLORS["neutral"]),
        )


class MemorySummarizer:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.client = None

        if OLLAMA_AVAILABLE:
            try:
                self.client = ollama
                self.client.list()
            except Exception:
                self.client = None

    def _extract_key_topics(self, memories: List[str]) -> List[str]:
        all_text = " ".join(memories).lower()

        common_topics = [
            "work",
            "family",
            "friends",
            "travel",
            "school",
            "college",
            "vacation",
            "holiday",
            "birthday",
            "wedding",
            "graduation",
            "job",
            "career",
            "home",
            "health",
            "fitness",
            "hobby",
            "sport",
            "music",
            "movie",
            "food",
            "restaurant",
            "celebration",
            "party",
            "meeting",
            "project",
            "achievement",
            "milestone",
        ]

        topics = []
        for topic in common_topics:
            if topic in all_text:
                topics.append(topic)

        return topics[:5]

    def _rule_based_summary(self, memories: List[str], person_name: str) -> Dict:
        if not memories:
            return {
                "summary": f"No memories recorded for {person_name} yet.",
                "key_topics": "",
            }

        emotions_count = {}
        for memory in memories:
            analyzer = SentimentAnalyzer()
            emotion = analyzer.analyze(memory)
            emotions_count[emotion.emotion] = emotions_count.get(emotion.emotion, 0) + 1

        dominant_emotion = (
            max(emotions_count, key=emotions_count.get) if emotions_count else "neutral"
        )

        key_topics = self._extract_key_topics(memories)
        key_topics_str = ", ".join(key_topics) if key_topics else "various topics"

        first_memory = (
            memories[0][:100] + "..." if len(memories[0]) > 100 else memories[0]
        )
        last_memory = (
            memories[-1][:100] + "..." if len(memories[-1]) > 100 else memories[-1]
        )

        summary = (
            f"Memories with {person_name} span {len(memories)} entries. "
            f"Overall tone: {dominant_emotion}. "
            f"Key themes: {key_topics_str}. "
            f"First memory: '{first_memory}'"
        )

        return {"summary": summary, "key_topics": key_topics_str}

    def _ollama_summary(self, memories: List[str], person_name: str) -> Dict:
        if not memories:
            return {
                "summary": f"No memories recorded for {person_name} yet.",
                "key_topics": "",
            }

        memories_text = "\n".join([f"- {m}" for m in memories])

        prompt = f"""Analyze these memories about {person_name} and provide a concise summary:

{memories_text}

Provide a JSON response with:
{{
  "summary": "A 2-3 sentence summary of the relationship and key themes",
  "key_topics": "Comma-separated list of 3-5 main topics discussed"
}}

Response:"""

        try:
            response = self.client.generate(
                model="llama3.2:1b",
                prompt=prompt,
                options={"temperature": 0.3, "num_predict": 200},
            )

            import json

            result_text = response["response"].strip()
            json_match = re.search(r"\{.*\}", result_text, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group())
                return {
                    "summary": result.get("summary", ""),
                    "key_topics": result.get("key_topics", ""),
                }
        except Exception:
            pass

        return self._rule_based_summary(memories, person_name)

    def summarize(self, memories: List[str], person_name: str) -> Dict:
        if not memories:
            return {
                "summary": f"No memories recorded for {person_name} yet.",
                "key_topics": "",
            }

        if self.client:
            return self._ollama_summary(memories, person_name)

        return self._rule_based_summary(memories, person_name)


class RelationshipSuggester:
    def __init__(self):
        self.analyzer = SentimentAnalyzer()

    def _calculate_similarity(self, person1_data: Dict, person2_data: Dict) -> float:
        similarity = 0.0

        shared_tags = set(person1_data.get("emotion_tags", [])) & set(
            person2_data.get("emotion_tags", [])
        )
        if person1_data.get("emotion_tags") and person2_data.get("emotion_tags"):
            similarity += len(shared_tags) / max(
                len(person1_data["emotion_tags"]), len(person2_data["emotion_tags"])
            )

        shared_topics = set(person1_data.get("topics", [])) & set(
            person2_data.get("topics", [])
        )
        similarity += len(shared_topics) * 0.2

        if shared_topics:
            similarity += min(0.3, len(shared_topics) * 0.1)

        return min(1.0, similarity)

    def suggest_relationships(
        self, persons_data: List[Dict], min_confidence: float = 0.3
    ) -> List[Dict]:
        suggestions = []

        for i, person1 in enumerate(persons_data):
            for person2 in persons_data[i + 1 :]:
                similarity = self._calculate_similarity(person1, person2)

                if similarity >= min_confidence:
                    shared_topics = set(person1.get("topics", [])) & set(
                        person2.get("topics", [])
                    )
                    shared_tags = set(person1.get("emotion_tags", [])) & set(
                        person2.get("emotion_tags", [])
                    )

                    reasons = []
                    if shared_topics:
                        reasons.append(
                            f"Both have memories about: {', '.join(list(shared_topics)[:3])}"
                        )
                    if shared_tags:
                        reasons.append(
                            f"Similar emotional tones: {', '.join(list(shared_tags)[:2])}"
                        )

                    suggestions.append(
                        {
                            "person1_id": person1["id"],
                            "person1_name": person1["name"],
                            "person2_id": person2["id"],
                            "person2_name": person2["name"],
                            "reason": ". ".join(reasons)
                            if reasons
                            else "Shared memories and experiences",
                            "confidence": round(similarity, 2),
                        }
                    )

        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        return suggestions[:10]
