import hmac
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from .config import settings

def get_fernet() -> Fernet:
    """Returns a Fernet instance derived from SECRETS_ENCRYPTION_KEY."""
    try:
        key = settings.SECRETS_ENCRYPTION_KEY.encode("utf-8")
        return Fernet(key)
    except Exception:
        # Fallback to generating a key in dev if invalid format
        return Fernet(Fernet.generate_key())

def encrypt_secret(plaintext: str) -> str:
    """Encrypts plaintext string to Fernet-encrypted ciphertext string."""
    if not plaintext:
        return ""
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")

def decrypt_secret(ciphertext: str) -> Optional[str]:
    """Decrypts Fernet ciphertext to plaintext string. Returns None on failure."""
    if not ciphertext:
        return None
    try:
        f = get_fernet()
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        return None

def compute_key_hash(raw_key: str, pepper: Optional[str] = None) -> str:
    """Computes HMAC-SHA256 hex digest of raw_key using the server pepper."""
    effective_pepper = (pepper or settings.API_KEY_PEPPER).encode("utf-8")
    return hmac.new(effective_pepper, raw_key.strip().encode("utf-8"), hashlib.sha256).hexdigest()

def secure_compare(a: str, b: str) -> bool:
    """Constant-time string comparison."""
    return hmac.compare_digest(a, b)

hash_api_key_hmac = compute_key_hash
