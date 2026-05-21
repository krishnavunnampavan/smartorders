import secrets


def generate_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)
