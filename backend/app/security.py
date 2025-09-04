from passlib.context import CryptContext

# Use bcrypt as the hashing algorithm industry standard for password hashing due to its resistance to brute-force attacks.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored hash.
    
    Args:
        plain_password: The password attempt from the user.
        hashed_password: The hash retrieved from the database.
        
    Returns:
        True if the password is correct, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Creates a secure hash from a plain-text password.
    
    Args:
        password: The plain-text password to hash.
        
    Returns:
        A string containing the bcrypt hash.
    """
    return pwd_context.hash(password)
