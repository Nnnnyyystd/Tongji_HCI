import hashlib
import hmac
import secrets


HASH_NAME = "sha256"
ITERATIONS = 120_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        HASH_NAME,
        password.encode("utf-8"),
        salt,
        ITERATIONS,
    )
    return f"{HASH_NAME}${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        hash_name, iterations, salt_hex, digest_hex = password_hash.split("$")
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac(
            hash_name,
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(actual, expected)


def create_access_token() -> str:
    return secrets.token_urlsafe(32)
