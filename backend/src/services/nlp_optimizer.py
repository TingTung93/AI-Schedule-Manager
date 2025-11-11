"""NLP model optimization for faster loading and inference."""

import spacy
from typing import Optional, Dict, Any
import pickle
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class NLPModelManager:
    """Manages NLP model loading and optimization."""

    _instance: Optional["NLPModelManager"] = None
    _model: Optional[Any] = None
    _model_cache_path = Path("/tmp/nlp_model_cache")

    def __new__(cls):
        """Singleton pattern for model manager."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize model manager."""
        if not hasattr(self, "initialized"):
            self.initialized = True
            self._model_cache_path.mkdir(exist_ok=True)

    @property
    def model(self):
        """Lazy load the NLP model."""
        if self._model is None:
            self._model = self._load_model()
        return self._model

    def _load_model(self):
        """Load NLP model with optimizations."""
        try:
            # Try to load from cache first
            cache_file = self._model_cache_path / "model.pkl"
            if cache_file.exists():
                logger.info("Loading NLP model from cache")
                with open(cache_file, "rb") as f:
                    return pickle.load(f)

            # Load spaCy model with only needed components
            logger.info("Loading NLP model (first time)")
            nlp = spacy.load("en_core_web_sm", disable=["lemmatizer", "textcat"])

            # Optimize for speed
            nlp.add_pipe("sentencizer")

            # Remove unnecessary components for our use case
            if "attribute_ruler" in nlp.pipe_names:
                nlp.remove_pipe("attribute_ruler")

            # Cache the model
            try:
                with open(cache_file, "wb") as f:
                    pickle.dump(nlp, f)
                logger.info("NLP model cached successfully")
            except Exception as e:
                logger.warning(f"Could not cache model: {e}")

            return nlp

        except Exception as e:
            logger.error(f"Failed to load NLP model: {e}")
            return None

    def process_batch(self, texts: list, batch_size: int = 100):
        """Process texts in batches for better performance."""
        if not self.model:
            return []

        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            docs = list(self.model.pipe(batch, n_process=2))
            results.extend(docs)

        return results

    def warm_up(self):
        """Warm up the model with sample text."""
        if self.model:
            _ = self.model("Sample text for warming up the NLP model")
            logger.info("NLP model warmed up")

    def clear_cache(self):
        """Clear cached model."""
        cache_file = self._model_cache_path / "model.pkl"
        if cache_file.exists():
            cache_file.unlink()
            logger.info("Model cache cleared")


class RuleParserOptimized:
    """Optimized rule parser using singleton NLP model."""

    def __init__(self):
        """Initialize optimized parser."""
        self.nlp_manager = NLPModelManager()
        self._rule_cache = {}

    async def parse_rule(self, rule_text: str) -> Dict[str, Any]:
        """Parse rule with caching."""
        # Check cache first
        if rule_text in self._rule_cache:
            logger.debug(f"Rule cache hit: {rule_text[:50]}...")
            return self._rule_cache[rule_text]

        # Process with NLP model
        doc = self.nlp_manager.model(rule_text)

        # Extract information (simplified for example)
        result = {
            "original_text": rule_text,
            "entities": [(ent.text, ent.label_) for ent in doc.ents],
            "tokens": [token.text for token in doc],
        }

        # Cache result
        self._rule_cache[rule_text] = result

        # Limit cache size
        if len(self._rule_cache) > 1000:
            # Remove oldest entries
            keys = list(self._rule_cache.keys())
            for key in keys[:100]:
                del self._rule_cache[key]

        return result

    def parse_batch(self, rules: list) -> list:
        """Parse multiple rules efficiently."""
        # Filter out cached rules
        uncached = [r for r in rules if r not in self._rule_cache]

        if uncached:
            # Process uncached rules in batch
            docs = self.nlp_manager.process_batch(uncached)

            # Cache results
            for rule, doc in zip(uncached, docs):
                self._rule_cache[rule] = {
                    "original_text": rule,
                    "entities": [(ent.text, ent.label_) for ent in doc.ents],
                    "tokens": [token.text for token in doc],
                }

        # Return all results
        return [self._rule_cache[r] for r in rules]
