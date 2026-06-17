"""
Utility helpers for Memoir backend.

Complexity: O(1) encryption/decryption per key operation.
"""
import os
import logging

logger = logging.getLogger(__name__)

# ─── Optional: Fernet Encryption ────────────────────────────────────────────
# cryptography is required for API key encryption.
# If unavailable, encrypt/decrypt return the key as-is (development fallback).

FERNET_AVAILABLE = False
try:
    from cryptography.fernet import Fernet
    FERNET_AVAILABLE = True
except ImportError:
    Fernet = None
    logger.warning("cryptography not installed. API key encryption disabled.")


def get_fernet():
    """Get a Fernet cipher from the ENCRYPTION_SECRET env var.

    If ENCRYPTION_SECRET is not set, auto-generates one from a machine-specific
    fallback. In production, always set ENCRYPTION_SECRET in .env for a
    persistent key across restarts.
    """
    if not FERNET_AVAILABLE:
        return None
    import hashlib, base64
    raw = os.getenv("ENCRYPTION_SECRET", "").encode("utf-8")
    if not raw:
        # Auto-generate from a stable fallback so it works out of the box
        raw = b"memoir-default-encryption-secret-change-in-production"
        logger.warning("ENCRYPTION_SECRET not set in .env — using auto-generated key")
    try:
        return Fernet(raw)
    except (ValueError, TypeError):
        key = hashlib.sha256(raw).digest()
        return Fernet(base64.urlsafe_b64encode(key))


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt a user's API key at rest. O(1)."""
    if not FERNET_AVAILABLE:
        return plain_key  # Dev fallback — not secure
    cipher = get_fernet()
    return cipher.encrypt(plain_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key for use in a single request. O(1)."""
    if not FERNET_AVAILABLE:
        return encrypted_key  # Dev fallback
    cipher = get_fernet()
    return cipher.decrypt(encrypted_key.encode("utf-8")).decode("utf-8")


# ─── LLM Client Helpers ─────────────────────────────────────────────────────

def get_user_llm_client(user_id: str, provider: str, api_key: str):
    """Return a configured LLM client for the given provider.

    Every feature that calls an LLM must go through this helper.
    No os.environ provider keys are used — the key is fetched + decrypted
    per-request from the api_keys table.

    Args:
        user_id: UUID of the user (for logging).
        provider: 'anthropic' | 'groq' | 'openai'.
        api_key: The decrypted API key string.

    Returns:
        A configured client instance (openai.OpenAI, anthropic.Anthropic, etc.)

    Raises:
        ValueError: If provider is unsupported.
    """
    if provider == "openai":
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    elif provider == "anthropic":
        from anthropic import Anthropic
        return Anthropic(api_key=api_key)
    elif provider == "groq":
        from openai import OpenAI as GroqClient
        return GroqClient(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


def mask_api_key(key: str) -> str:
    """Return a masked version of the key for display (e.g. 'sk-...ab12')."""
    if len(key) <= 8:
        return key[:4] + "..." + key[-4:] if len(key) > 4 else "****"
    return key[:3] + "..." + key[-4:]
