
# PrepAI - Shared Database & Authentication

import os
import jwt
import mysql.connector

from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# .env file se configuration load karna
load_dotenv()

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# JWT Bearer authentication
security = HTTPBearer()


# MySQL database connection
def get_db_connection():
    db = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )
    return db


# JWT token verify karna aur user ID validate karna
def verify_access_token(
    credentials: HTTPAuthorizationCredentials
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp"]}
        )

        user_id = payload.get("sub")

        if not isinstance(user_id, str) or not user_id.isdigit():
            raise HTTPException(
                status_code=401,
                detail="Invalid token user ID"
            )

        return payload

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
