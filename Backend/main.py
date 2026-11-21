from fastapi import FastAPI, HTTPException, Depends, UploadFile, File #FastAPI ko btne  ke liye ki endpoint file upld accept krga

from pydantic import BaseModel, model_validator,EmailStr, Field, field_validator #data validation karne wali library,apne data models banane ke liye base class
import mysql.connector

from pwdlib import PasswordHash #normal password to hashpassword

import jwt #jwt token
import os
import json # JSON evaluation result ko database mein save karne ke liye

from dotenv import load_dotenv # .env file ki values Python mein load karna.

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  #token receive karna,received token access karna

# Import Python-based fallback evaluator for text answers when AI is unavailable
from fallback_evaluator import evaluate_answer_without_ai

# Import Groq AI evaluator for descriptive interview answers
from ai_answer_evaluator import evaluate_answer_with_ai

from ai_question_generator import generate_mcq_questions
from ai_mcq_evaluator import evaluate_mcq_answer_with_ai
from ai_mock_question_generator import generate_mock_questions

from jd_routes import router as jd_router #jd analysis
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
# Resume Analysis APIs import karna
from resume_routes import router as resume_router


# Configure CORS to allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,

    # Allowed frontend development URLs
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    # Allow cookies and authentication-related credentials
    allow_credentials=True,

    # Allow HTTP methods such as GET, POST, PUT, DELETE, PATCH
    allow_methods=["*"],

    # Allow headers such as Content-Type and Authorization
    allow_headers=["*"],
)


# Resume router ko FastAPI app se connect karna
app.include_router(resume_router)
# New JD Analysis router
app.include_router(jd_router)
password_hash = PasswordHash.recommended() #recommended password-hashing configuration create karta hai


load_dotenv() #.env files ki values load krtahai
SECRET_KEY = os.getenv("JWT_SECRET_KEY") #secret key ki value read krta hai

## JWT token ko sign aur verify karne ke liye algorithm.
ALGORITHM = "HS256"

from datetime import datetime, timedelta, timezone
#login ke baad token banata hai.
def create_access_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return token


# JWT token signature and expiry verification
security = HTTPBearer()

def verify_access_token(
    credentials: HTTPAuthorizationCredentials
):
    token = credentials.credentials

    try:
        # Verify JWT signature and expiration
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp"]}
        )

        # Validate user ID
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

# Protected endpoint that returns the authenticated user's details using JWT valid token se logged-in user ki details deta hai
@app.get("/users/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        cursor.execute(
            "SELECT id, name, email FROM users WHERE id = %s",
            (user_id,)
        )

        result = cursor.fetchone()

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return {
            "user_id": result[0],
            "name": result[1],
            "email": result[2]
        }

    except HTTPException:
        raise

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()
# MySQL Database Connection
def get_db_connection():
    db = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )
    return db

print("MySQL Connected Successfully!")

from pydantic import BaseModel, EmailStr, Field, field_validator

# User Create Model
class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty")

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if value.strip() == "":
            raise ValueError("Password cannot be empty")

        return value


# User Update Model
class UserUpdate(BaseModel):
    name: str
    email: str

# login model
class UserLogin(BaseModel):
    email: str
    password: str

# Interview Answer Model
class InterviewAnswerCreate(BaseModel):
    interview_id: int
    question_id: int
    user_answer: str


# Read User by ID
@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    logged_in_user_id = int(payload["sub"])

    if user_id != logged_in_user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to access this user"
        )

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, email
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        )

        result = cursor.fetchone()

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return result

    except HTTPException:
        raise

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()



# Create New User
@app.post("/users")
def create_user(user: UserCreate):
    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        # Hash password before storing it
        hashed_password = password_hash.hash(user.password)

        query = """
        INSERT INTO users (name, email, password_hash)
        VALUES (%s, %s, %s)
        """

        values = (
            user.name,
            user.email,
            hashed_password
        )

        cursor.execute(query, values)
        db.commit()

        return {
            "message": "User created successfully"
        }

    except mysql.connector.IntegrityError:
        if db is not None:
            db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    except mysql.connector.Error:
        if db is not None:
            db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# User Login
@app.post("/login")
def login_user(user: UserLogin):
    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = %s
            """,
            (user.email,)
        )

        result = cursor.fetchone()

        if result is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        stored_hash = result[3]

        if not password_hash.verify(user.password, stored_hash):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        access_token = create_access_token(result[0])

        return {
            "message": "Login successful",
            "user_id": result[0],
            "name": result[1],
            "email": result[2],
            "access_token": access_token,
            "token_type": "bearer"
        }

    except HTTPException:
        raise

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Update User
@app.put("/users/{user_id}")
def update_user(
    user_id: int,
    user: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    logged_in_user_id = int(payload["sub"])

    if user_id != logged_in_user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to update this user"
        )

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE id = %s",
            (user_id,)
        )

        existing_user = cursor.fetchone()

        if existing_user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        query = """
        UPDATE users
        SET name = %s, email = %s
        WHERE id = %s
        """

        values = (user.name, user.email, user_id)

        cursor.execute(query, values)
        db.commit()

        return {"message": "User updated successfully"}

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except mysql.connector.IntegrityError:
        if db is not None:
            db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    except mysql.connector.Error:
        if db is not None:
            db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Delete User
@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    logged_in_user_id = int(payload["sub"])

    if user_id != logged_in_user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to delete this user"
        )

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE id = %s",
            (user_id,)
        )

        existing_user = cursor.fetchone()

        if existing_user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        cursor.execute(
            "DELETE FROM users WHERE id = %s",
            (user_id,)
        )

        db.commit()

        return {
            "message": "User deleted successfully"
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except mysql.connector.Error:
        if db is not None:
            db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Interview Session Create Model
class InterviewSessionCreate(BaseModel):
    role: str | None = None
    experience: str = "Fresher"
    topics: str | None = None
    interview_mode: str
    question_format: str

    @model_validator(mode="after")
    def validate_interview_format(self):

        allowed_roles = [
            "Python Developer",
            "Java Developer",
            "AI/ML Engineer",
            "Full Stack Developer",
            "Pharma Production"
        ]

        allowed_mcq_topics = [
            "OOPs",
            "DBMS",
            "Technical Fundamentals",
            "Operating Systems",
            "Computer Networks",
            "System Design",
            "DSA",
            "Pharma Production & GMP"
        ]

        if self.interview_mode == "mock_interview":

            if self.role not in allowed_roles:
                raise ValueError("Please select a valid interview role")

            if self.question_format != "text":
                raise ValueError("Mock interview must use text format")

        elif self.interview_mode == "mcq_practice":

            if self.role is not None:
                raise ValueError("MCQ Practice does not require a role")

            if self.topics not in allowed_mcq_topics:
                raise ValueError("Please select a valid MCQ topic")

            if self.question_format != "mcq":
                raise ValueError("MCQ Practice must use MCQ format")

        else:
            raise ValueError("Invalid interview mode")

        return self



# Create New Interview Session
@app.post("/interviews")
def create_interview(
    interview: InterviewSessionCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    allowed_roles = [
        "Python Developer",
        "Java Developer",
        "AI/ML Engineer",
        "Full Stack Developer",
        "Pharma Production"
    ]

    allowed_mcq_topics = [
        "OOPs",
        "DBMS",
        "Technical Fundamentals",
        "Operating Systems",
        "Computer Networks",
        "System Design",
        "DSA",
        "Pharma Production & GMP"
    ]

    if interview.interview_mode == "mcq_practice":

        if interview.role is not None:
            raise HTTPException(
                status_code=400,
                detail="MCQ Practice does not require a role"
            )

        if interview.topics not in allowed_mcq_topics:
            raise HTTPException(
                status_code=400,
                detail="Invalid MCQ topic"
            )

        db_role = "MCQ Practice"
        db_experience = "Fresher"
        db_topic = interview.topics

    elif interview.interview_mode == "mock_interview":

        if interview.role not in allowed_roles:
            raise HTTPException(
                status_code=400,
                detail="Invalid interview role"
            )

        db_role = interview.role
        db_experience = interview.experience
        db_topic = "Role Based"

    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid interview mode"
        )

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor()

        query = """
        INSERT INTO interview_sessions
        (user_id, role, experience, topics,
         interview_mode, question_format)
        VALUES (%s, %s, %s, %s, %s, %s)
        """

        values = (
            user_id,
            db_role,
            db_experience,
            db_topic,
            interview.interview_mode,
            interview.question_format
        )

        cursor.execute(query, values)
        db.commit()

        return {
            "message": "Session created successfully",
            "interview_id": cursor.lastrowid,
            "user_id": user_id,
            "interview_mode": interview.interview_mode,
            "role": interview.role,
            "topic": db_topic
        }

    except mysql.connector.Error:
        if db is not None:
            db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Get Interview Session
@app.get("/interviews/{interview_id}")
def get_interview_session(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, role, experience, topics,
                   interview_mode, question_format,
                   status, created_at
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        return interview

    except HTTPException:
        raise

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()





# Get Questions for an Interview Session
@app.get("/interviews/{interview_id}/questions")
def get_interview_questions(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # STEP 1: Verify session ownership
        cursor.execute(
            """
            SELECT role, topics, interview_mode, question_format
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        mode = interview["interview_mode"]

        if mode not in ["mcq_practice", "mock_interview", "practice_test"]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported interview mode"
            )

        # STEP 2: Check whether questions are already mapped
        if mode in ["mcq_practice", "mock_interview"]:

            cursor.execute(
                """
                SELECT
                    iq.id,
                    iq.role,
                    iq.topic,
                    iq.question_text,
                    iq.question_type,
                    iq.options
                FROM interview_session_questions AS isq
                INNER JOIN interview_questions AS iq
                    ON isq.question_id = iq.id
                WHERE isq.interview_id = %s
                ORDER BY isq.display_order ASC
                """,
                (interview_id,)
            )

            saved_questions = cursor.fetchall()

            if saved_questions:
                return {
                    "interview_id": interview_id,
                    "interview_mode": mode,
                    "total": len(saved_questions),
                    "questions": saved_questions
                }

        # STEP 3: Generate or fetch MCQ questions
        if mode == "mcq_practice":

            questions = None

            # First preference: Groq generates MCQs
            try:
                generated_questions = generate_mcq_questions(
                    interview["topics"]
                )

                questions = []

                for question in generated_questions:

                    cursor.execute(
                        """
                        INSERT INTO interview_questions
                        (
                            role,
                            topic,
                            question_text,
                            question_type,
                            options,
                            correct_answer,
                            reference_answer,
                            source
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            "MCQ Practice",
                            interview["topics"],
                            question["question_text"],
                            "mcq",
                            json.dumps(
                                question["options"],
                                ensure_ascii=False
                            ),
                            question["correct_answer"],
                            question["explanation"],
                            "groq"
                        )
                    )

                    questions.append({
                        "id": cursor.lastrowid,
                        "role": "MCQ Practice",
                        "topic": interview["topics"],
                        "question_text": question["question_text"],
                        "question_type": "mcq",
                        "options": question["options"]
                    })

                print("Successfully generated and saved Groq MCQs.")

            except Exception as groq_error:

                db.rollback()

                print("Groq MCQ generation failed:", str(groq_error))
                print("Switching to MySQL MCQ fallback bank.")

                # Re-verify session after rollback
                cursor.execute(
                    """
                    SELECT role, topics, interview_mode, question_format
                    FROM interview_sessions
                    WHERE id = %s AND user_id = %s
                    """,
                    (interview_id, user_id)
                )

                interview = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT
                        id,
                        role,
                        topic,
                        question_text,
                        question_type,
                        options
                    FROM interview_questions
                    WHERE role = %s
                      AND topic = %s
                      AND question_type = 'mcq'
                      AND source != 'groq'
                    ORDER BY id ASC
                    LIMIT 5
                    """,
                    ("MCQ Practice", interview["topics"])
                )

                questions = cursor.fetchall()

                if len(questions) != 5:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Groq is unavailable and the MySQL fallback "
                            f"bank has only {len(questions)} MCQs for "
                            f"{interview['topics']}. Exactly 5 are required."
                        )
                    )

            # STEP 4: Map MCQ questions to this session
            for index, question in enumerate(questions, start=1):

                cursor.execute(
                    """
                    INSERT INTO interview_session_questions
                    (
                        interview_id,
                        question_id,
                        display_order
                    )
                    VALUES (%s, %s, %s)
                    """,
                    (
                        interview_id,
                        question["id"],
                        index
                    )
                )

            db.commit()

            return {
                "interview_id": interview_id,
                "interview_mode": mode,
                "total": len(questions),
                "questions": questions
            }

        # STEP 5: Generate or fetch Mock Interview questions
        elif mode == "mock_interview":

            questions = []

            # First preference: Groq generates exactly 5 role-based questions
            try:
                generated_questions = generate_mock_questions(
                    interview["role"]
                )

                print("Successfully generated 5 Groq Mock Interview questions.")

            except Exception as groq_error:

                print("Groq Mock generation failed:", str(groq_error))
                print("Switching to MySQL Mock Interview fallback bank.")

                db.rollback()

                # Re-verify session after rollback
                cursor.execute(
                    """
                    SELECT role, topics, interview_mode, question_format
                    FROM interview_sessions
                    WHERE id = %s AND user_id = %s
                    """,
                    (interview_id, user_id)
                )

                interview = cursor.fetchone()

                # Fetch fallback questions using role only
                cursor.execute(
                    """
                    SELECT
                        id,
                        role,
                        topic,
                        question_text,
                        question_type,
                        options
                    FROM interview_questions
                    WHERE role = %s
                      AND question_type = 'text'
                      AND (source IS NULL OR source <> 'groq')
                    ORDER BY id ASC
                    LIMIT 5
                    """,
                    (interview["role"],)
                )

                questions = cursor.fetchall()

                if len(questions) != 5:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Groq is unavailable and the MySQL fallback "
                            f"bank has only {len(questions)} questions for "
                            f"{interview['role']}. Exactly 5 are required."
                        )
                    )

            else:
                # Save Groq-generated questions in MySQL
                for question in generated_questions:

                    cursor.execute(
                        """
                        INSERT INTO interview_questions
                        (
                            role,
                            topic,
                            question_text,
                            question_type,
                            options,
                            correct_answer,
                            reference_answer,
                            source
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            interview["role"],
                            "Role Based",
                            question["question_text"],
                            "text",
                            None,
                            None,
                            question["reference_answer"],
                            "groq"
                        )
                    )

                    questions.append({
                        "id": cursor.lastrowid,
                        "role": interview["role"],
                        "topic": "Role Based",
                        "question_text": question["question_text"],
                        "question_type": "text",
                        "options": None
                    })

            # Map all 5 selected questions to this session
            for index, question in enumerate(questions, start=1):

                cursor.execute(
                    """
                    INSERT INTO interview_session_questions
                    (
                        interview_id,
                        question_id,
                        display_order
                    )
                    VALUES (%s, %s, %s)
                    """,
                    (
                        interview_id,
                        question["id"],
                        index
                    )
                )

            db.commit()

            return {
                "interview_id": interview_id,
                "interview_mode": mode,
                "total": len(questions),
                "questions": questions
            }

        # STEP 6: Preserve existing Practice Test behaviour
        elif mode == "practice_test":

            query = """
                SELECT
                    id,
                    role,
                    topic,
                    question_text,
                    question_type,
                    options
                FROM interview_questions
                WHERE role = %s
            """

            values = [interview["role"]]

            topics = [
                topic.strip()
                for topic in interview["topics"].split(",")
                if topic.strip()
            ]

            if topics:
                conditions = []

                for topic in topics:
                    conditions.append("topic LIKE %s")
                    values.append(f"%{topic}%")

                query += " AND (" + " OR ".join(conditions) + ")"

            query += " ORDER BY id ASC"

            cursor.execute(query, tuple(values))
            questions = cursor.fetchall()

            return {
                "interview_id": interview_id,
                "interview_mode": mode,
                "total": len(questions),
                "questions": questions
            }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except mysql.connector.Error as db_error:

        if db is not None:
            db.rollback()

        print("Question retrieval database error:", str(db_error))

        raise HTTPException(
            status_code=500,
            detail="Database error while retrieving interview questions"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()

# Get Questions with Role and Topic Filters
@app.get("/questions")
def get_questions(
    role: str = None,
    topic: str = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    verify_access_token(credentials)

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        query = """
        SELECT id, role, topic, question_text,
               question_type, options, source
        FROM interview_questions
        WHERE 1=1
        """
        values = []

        if role:
            query += " AND role = %s"
            values.append(role)

        if topic:
            query += " AND topic = %s"
            values.append(topic)

        cursor.execute(query, tuple(values))
        questions = cursor.fetchall()

        return {
            "total": len(questions),
            "questions": questions
        }

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()

# Save Interview Answer and Evaluate Candidate Response
@app.post("/interviews/answers")
def save_interview_answer(
    answer: InterviewAnswerCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # STEP 1: Verify interview belongs to logged-in user
        cursor.execute(
            """
            SELECT id, role, topics, interview_mode, status
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (answer.interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        # STEP 1.5: Prevent answers after interview completion
        if interview["status"] == "completed":
            raise HTTPException(
                status_code=409,
                detail="This interview is already completed. You cannot submit more answers."
            )

        # STEP 2: Fetch question details
        cursor.execute(
            """
            SELECT
                id,
                role,
                topic,
                question_type,
                correct_answer,
                question_text,
                reference_answer,
                options,
                source
            FROM interview_questions
            WHERE id = %s
            """,
            (answer.question_id,)
        )

        question = cursor.fetchone()

        if question is None:
            raise HTTPException(
                status_code=404,
                detail="Question not found"
            )

        # STEP 3: Verify question belongs to this interview
        if interview["interview_mode"] == "mcq_practice":

            if (
                question["question_type"] != "mcq"
                or question["role"] != "MCQ Practice"
                or question["topic"] != interview["topics"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail="This question does not belong to this MCQ session"
                )

        elif interview["interview_mode"] == "mock_interview":

            if (
                question["question_type"] != "text"
                or question["role"] != interview["role"]

            ):
                raise HTTPException(
                    status_code=400,
                    detail="This question does not belong to this interview session"
                )

        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid interview mode"
            )

        # STEP 3.5: Verify question is mapped to this session
        cursor.execute(
            """
            SELECT id
            FROM interview_session_questions
            WHERE interview_id = %s
              AND question_id = %s
            """,
            (answer.interview_id, answer.question_id)
        )

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=400,
                detail="This question is not mapped to this interview session"
            )

        # STEP 3.6: Prevent duplicate answer submissions
        cursor.execute(
            """
            SELECT id
            FROM interview_answers
            WHERE user_id = %s
              AND interview_id = %s
              AND question_id = %s
            """,
            (
                user_id,
                answer.interview_id,
                answer.question_id
            )
        )

        existing_answer = cursor.fetchone()

        if existing_answer is not None:
            raise HTTPException(
                status_code=409,
                detail="You have already submitted an answer for this question"
            )

        # STEP 4: Initialize evaluation variables
        is_correct = None
        score = None
        ai_feedback = None
        evaluation = None

        source = (question.get("source") or "manual").strip().lower()

        # =====================================================
        # STEP 5: MCQ EVALUATION
        # =====================================================
        if question["question_type"] == "mcq":

            correct_answer = (
                question["correct_answer"] or ""
            ).strip()

            options = question["options"]

            if isinstance(options, str):
                try:
                    options = json.loads(options)
                except json.JSONDecodeError:
                    raise HTTPException(
                        status_code=500,
                        detail="Invalid MCQ options format in database"
                    )

            if not isinstance(options, dict):
                raise HTTPException(
                    status_code=500,
                    detail="MCQ options must be a valid dictionary"
                )

            normalized_options = {
                str(key).strip().upper(): str(value)
                for key, value in options.items()
            }

            if set(normalized_options.keys()) != {"A", "B", "C", "D"}:
                raise HTTPException(
                    status_code=500,
                    detail="MCQ must contain options A, B, C and D"
                )

            # Identify correct option from this question's own answer key
            correct_key = correct_answer.upper()

            if correct_key not in normalized_options:
                correct_key = None

                for key, value in normalized_options.items():
                    if correct_answer.casefold() == value.strip().casefold():
                        correct_key = key
                        break

            if correct_key is None:
                raise HTTPException(
                    status_code=500,
                    detail="Invalid correct answer stored for this question"
                )

            submitted_answer = answer.user_answer.strip()

            # SYSTEM 1: Groq-generated MCQs
            if source == "groq":

                try:
                    evaluation = evaluate_mcq_answer_with_ai(
                        question_text=question["question_text"],
                        options=normalized_options,
                        correct_answer=correct_key,
                        candidate_answer=submitted_answer,
                        reference_answer=question["reference_answer"]
                    )

                    is_correct = evaluation["is_correct"]

                    print("Groq MCQ evaluated using Groq AI")

                except Exception as ai_error:

                    print("Groq MCQ evaluation failed:", str(ai_error))

                    # Python fallback using this question's own answer key
                    submitted_key = submitted_answer.upper()

                    if submitted_key not in normalized_options:
                        submitted_key = None

                        for key, value in normalized_options.items():
                            if submitted_answer.casefold() == value.strip().casefold():
                                submitted_key = key
                                break

                    is_correct = submitted_key == correct_key

                    evaluation = {
                        "is_correct": is_correct,
                        "correct_answer": correct_key,
                        "explanation": question["reference_answer"],
                        "feedback": (
                            "Correct answer. Evaluated using this question's "
                            "saved answer key because Groq was unavailable."
                            if is_correct else
                            "Incorrect answer. Evaluated using this question's "
                            "saved answer key because Groq was unavailable."
                        ),
                        "evaluation_type": "rule_based_fallback",
                        "provider": "python"
                    }

                    print("Groq MCQ evaluated using Python fallback")

            # SYSTEM 2: Existing MySQL MCQ questions
            else:

                submitted_key = submitted_answer.upper()

                if submitted_key not in normalized_options:
                    submitted_key = None

                    for key, value in normalized_options.items():
                        if submitted_answer.casefold() == value.strip().casefold():
                            submitted_key = key
                            break

                is_correct = submitted_key == correct_key

                evaluation = {
                    "is_correct": is_correct,
                    "correct_answer": correct_key,
                    "explanation": (
                        question["reference_answer"]
                        or f"The correct answer is {correct_key}: "
                           f"{normalized_options[correct_key]}"
                    ),
                    "feedback": (
                        "Correct answer!"
                        if is_correct
                        else "Incorrect answer. Please review the explanation."
                    ),
                    "evaluation_type": "rule_based_fallback",
                    "provider": "python"
                }

                print("MySQL MCQ evaluated using Python fallback")

            ai_feedback = json.dumps(
                evaluation,
                ensure_ascii=False
            )

        # =====================================================
        # STEP 6: DESCRIPTIVE / TEXT ANSWER EVALUATION
        # =====================================================
        elif question["question_type"] == "text":

            # SYSTEM 1: Groq-generated descriptive questions
            if source == "groq":

                try:
                    evaluation = evaluate_answer_with_ai(
                        question_text=question["question_text"],
                        candidate_answer=answer.user_answer,
                        reference_answer=question["reference_answer"]
                    )

                    print("Groq text question evaluated using Groq AI")

                except Exception as ai_error:

                    print("Groq text evaluation failed:", str(ai_error))

                    # Evaluate using the SAME question's saved Groq reference answer
                    try:
                        evaluation = evaluate_answer_without_ai(
                            candidate_answer=answer.user_answer,
                            reference_answer=question["reference_answer"]
                        )

                        evaluation["provider"] = "python"
                        evaluation["fallback_reason"] = "Groq evaluator unavailable"

                        print(
                            "Groq text question evaluated using its own "
                            "saved reference answer"
                        )

                    except Exception as fallback_error:

                        print(
                            "Groq reference-answer fallback failed:",
                            str(fallback_error)
                        )

                        evaluation = {
                            "evaluation_type": "manual_review_required",
                            "provider": "none",
                            "score": None,
                            "score_out_of": 100,
                            "strengths": [],
                            "weaknesses": [],
                            "missing_concepts": [],
                            "improvement_suggestions": [
                                "This answer requires manual evaluation."
                            ],
                            "overall_feedback": (
                                "Groq evaluation and reference-answer fallback "
                                "are unavailable. Your answer has been saved "
                                "for manual review."
                            )
                        }

            # SYSTEM 2: Existing MySQL fallback/manual text questions
            else:

                try:
                    evaluation = evaluate_answer_without_ai(
                        candidate_answer=answer.user_answer,
                        reference_answer=question["reference_answer"]
                    )

                    print("MySQL text question evaluated using Python fallback")

                except Exception as fallback_error:

                    print(
                        "Python fallback evaluation failed:",
                        str(fallback_error)
                    )

                    evaluation = {
                        "evaluation_type": "manual_review_required",
                        "provider": "none",
                        "score": None,
                        "score_out_of": 100,
                        "strengths": [],
                        "weaknesses": [],
                        "missing_concepts": [],
                        "improvement_suggestions": [
                            "This answer requires manual evaluation."
                        ],
                        "overall_feedback": (
                            "Automated evaluation is unavailable. "
                            "Your answer has been saved for manual review."
                        )
                    }

            # Extract score and serialize feedback
            score = evaluation.get("score")

            ai_feedback = json.dumps(
                evaluation,
                ensure_ascii=False
            )

        # =====================================================
        # STEP 7: SAVE ANSWER AND EVALUATION
        # =====================================================
        cursor.execute(
            """
            INSERT INTO interview_answers
            (
                user_id,
                interview_id,
                question_id,
                user_answer,
                is_correct,
                ai_feedback,
                score
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                answer.interview_id,
                answer.question_id,
                answer.user_answer,
                is_correct,
                ai_feedback,
                score
            )
        )

        answer_id = cursor.lastrowid

        db.commit()

        # STEP 8: RETURN EVALUATION RESULT
        return {
            "message": "Answer saved successfully",
            "answer_id": answer_id,
            "interview_id": answer.interview_id,
            "question_id": answer.question_id,
            "is_correct": is_correct,
            "score": score,
            "evaluation": evaluation
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except mysql.connector.Error as db_error:

        if db is not None:
            db.rollback()

        print("Database error:", str(db_error))

        raise HTTPException(
            status_code=500,
            detail="Database error while saving answer"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()

# Get Answers for an Interview
@app.get("/interviews/{interview_id}/answers")
def get_interview_answers(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Verify interview ownership
        cursor.execute(
            """
            SELECT id
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        # Fetch answers
        cursor.execute(
            """
            SELECT
                ia.id,
                ia.interview_id,
                ia.question_id,
                iq.question_text,
                iq.question_type,
                ia.user_answer,
                ia.is_correct,
                ia.ai_feedback,
                ia.score,
                ia.answered_at
            FROM interview_answers AS ia
            JOIN interview_questions AS iq
                ON ia.question_id = iq.id
            WHERE ia.interview_id = %s
              AND ia.user_id = %s
            """,
            (interview_id, user_id)
        )

        answers = cursor.fetchall()

        return {
            "total": len(answers),
            "answers": answers
        }

    except HTTPException:
        raise

    except mysql.connector.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()



# Get Final Result for MCQ Practice
@app.get("/interviews/{interview_id}/result")
def get_interview_result(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Verify interview session ownership
        cursor.execute(
            """
            SELECT id, topics, interview_mode
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        if interview["interview_mode"] != "mcq_practice":
            raise HTTPException(
                status_code=400,
                detail="Result API is only available for MCQ Practice"
            )

        # Count questions mapped to this session only.
        # Groq = 10, MySQL fallback = 5.
        cursor.execute(
            """
            SELECT COUNT(*) AS total_questions
            FROM interview_session_questions AS isq
            INNER JOIN interview_questions AS iq
                ON isq.question_id = iq.id
            WHERE isq.interview_id = %s
              AND iq.question_type = 'mcq'
            """,
            (interview_id,)
        )

        total_questions = cursor.fetchone()["total_questions"]

        if total_questions == 0:
            raise HTTPException(
                status_code=409,
                detail="No MCQ questions are mapped to this interview session"
            )

        # Calculate attempted and correct answers
        cursor.execute(
            """
            SELECT
                COUNT(DISTINCT ia.question_id) AS attempted,
                COUNT(DISTINCT CASE
                    WHEN ia.is_correct = 1 THEN ia.question_id
                END) AS correct
            FROM interview_answers AS ia
            INNER JOIN interview_session_questions AS isq
                ON ia.interview_id = isq.interview_id
               AND ia.question_id = isq.question_id
            INNER JOIN interview_questions AS iq
                ON isq.question_id = iq.id
            WHERE ia.interview_id = %s
              AND ia.user_id = %s
              AND iq.question_type = 'mcq'
            """,
            (interview_id, user_id)
        )

        result = cursor.fetchone()

        attempted = result["attempted"]
        correct = result["correct"]
        incorrect = attempted - correct
        unanswered = total_questions - attempted

        score = correct
        percentage = round((correct / total_questions) * 100, 2)

        is_completed = attempted == total_questions

        # Overall test feedback
        if percentage >= 90:
            overall_feedback = (
                "Excellent performance! You have a strong understanding "
                "of this topic. Keep practising to maintain your accuracy."
            )
        elif percentage >= 75:
            overall_feedback = (
                "Good work! Your fundamentals are strong. Review the questions "
                "you missed to improve further."
            )
        elif percentage >= 50:
            overall_feedback = (
                "Fair attempt. You understand some concepts, but should revise "
                "the incorrect answers and practise this topic again."
            )
        else:
            overall_feedback = (
                "You need more practice in this topic. Revisit the fundamentals, "
                "review the explanations for incorrect answers, and try again."
            )

        return {
            "interview_id": interview_id,
            "topic": interview["topics"],
            "total_questions": total_questions,
            "attempted": attempted,
            "correct_answers": correct,
            "incorrect_answers": incorrect,
            "unanswered": unanswered,
            "score": score,
            "score_out_of": total_questions,
            "percentage": percentage,
            "is_completed": is_completed,
            "overall_feedback": overall_feedback
        }

    except HTTPException:
        raise

    except mysql.connector.Error as db_error:
        print("Database error while calculating MCQ result:", str(db_error))

        raise HTTPException(
            status_code=500,
            detail="Database error while calculating result"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Complete Interview Session
@app.patch("/interviews/{interview_id}/complete")
def complete_interview(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Verify session ownership
        cursor.execute(
            """
            SELECT id, interview_mode, status
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        if interview["status"] == "completed":
            raise HTTPException(
                status_code=409,
                detail="Interview is already completed"
            )

        mode = interview["interview_mode"]

        if mode not in ["mcq_practice", "mock_interview"]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported interview mode"
            )

        # Get actual question count mapped to this session
        cursor.execute(
            """
            SELECT COUNT(*) AS total_questions
            FROM interview_session_questions
            WHERE interview_id = %s
            """,
            (interview_id,)
        )

        total_questions = cursor.fetchone()["total_questions"]

        if total_questions == 0:
            raise HTTPException(
                status_code=409,
                detail="No questions are mapped to this interview session"
            )

        # Mock Interview must remain exactly 5 questions
        if mode == "mock_interview" and total_questions != 5:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Mock Interview must contain exactly 5 questions. "
                    f"Found {total_questions}."
                )
            )

        # Count answers submitted for mapped questions only
        cursor.execute(
            """
            SELECT COUNT(DISTINCT ia.question_id) AS attempted
            FROM interview_answers AS ia
            INNER JOIN interview_session_questions AS isq
                ON ia.interview_id = isq.interview_id
               AND ia.question_id = isq.question_id
            WHERE ia.interview_id = %s
              AND ia.user_id = %s
            """,
            (interview_id, user_id)
        )

        attempted = cursor.fetchone()["attempted"]

        if attempted != total_questions:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Interview cannot be completed. "
                    f"Only {attempted} out of {total_questions} questions answered."
                )
            )

        # Update interview status
        cursor.execute(
            """
            UPDATE interview_sessions
            SET status = 'completed'
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        db.commit()

        return {
            "message": "Interview completed successfully",
            "interview_id": interview_id,
            "attempted": attempted,
            "total_questions": total_questions,
            "status": "completed"
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except mysql.connector.Error as db_error:
        if db is not None:
            db.rollback()

        print("Database error while completing interview:", str(db_error))

        raise HTTPException(
            status_code=500,
            detail="Database error"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Get Final Mock Interview Report
@app.get("/interviews/{interview_id}/summary")
def get_interview_summary(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # STEP 1: Verify session ownership and mode
        cursor.execute(
            """
            SELECT id, role, topics, interview_mode, status, created_at
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        if interview["interview_mode"] != "mock_interview":
            raise HTTPException(
                status_code=400,
                detail="Final report is only available for Mock Interview"
            )

        # STEP 2: Fetch all submitted answers
        cursor.execute(
            """
            SELECT
                ia.question_id,
                iq.question_text,
                ia.user_answer,
                ia.score,
                ia.ai_feedback,
                ia.answered_at
            FROM interview_answers ia
            JOIN interview_questions iq
                ON ia.question_id = iq.id
            WHERE ia.interview_id = %s
              AND ia.user_id = %s
            ORDER BY iq.id ASC
            """,
            (interview_id, user_id)
        )

        answers = cursor.fetchall()

        if len(answers) != 5:
            raise HTTPException(
                status_code=409,
                detail=f"Final report requires 5 answers. Found {len(answers)}."
            )

        if interview["status"] != "completed":
            raise HTTPException(
                status_code=409,
                detail="Complete the interview before viewing the final report"
            )

        # STEP 3: Calculate average score
        scored_answers = [
            answer for answer in answers
            if answer["score"] is not None
        ]

        if len(scored_answers) != 5:
            raise HTTPException(
                status_code=409,
                detail="All 5 answers must have evaluation scores"
            )

        average_score = round(
            sum(float(answer["score"]) for answer in scored_answers) / 5,
            2
        )

        # STEP 4: Prepare combined feedback
        strengths = []
        weaknesses = []
        suggestions = []
        question_reports = []

        for answer in answers:

            try:
                feedback = (
                    json.loads(answer["ai_feedback"])
                    if answer["ai_feedback"]
                    else {}
                )
            except (json.JSONDecodeError, TypeError):
                feedback = {}

            for item in feedback.get("strengths", []):
                if item not in strengths:
                    strengths.append(item)

            for item in feedback.get("weaknesses", []):
                if item not in weaknesses:
                    weaknesses.append(item)

            for item in feedback.get("improvement_suggestions", []):
                if item not in suggestions:
                    suggestions.append(item)

            question_reports.append({
                "question_id": answer["question_id"],
                "question": answer["question_text"],
                "your_answer": answer["user_answer"],
                "score": float(answer["score"]),
                "evaluation": feedback,
                "answered_at": answer["answered_at"]
            })

        # STEP 5: Return final report
        return {
            "interview_id": interview_id,
            "role": interview["role"],
            "topic": interview["topics"],
            "status": interview["status"],
            "date": interview["created_at"],
            "total_questions": 5,
            "attempted": 5,
            "average_score": average_score,
            "score_out_of": 100,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "improvement_suggestions": suggestions,
            "question_reports": question_reports
        }

    except HTTPException:
        raise

    except mysql.connector.Error as error:
        print("Final report database error:", str(error))

        raise HTTPException(
            status_code=500,
            detail="Database error while generating final report"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()


# Get Separate MCQ Practice and Mock Interview History
@app.get("/users/me/interviews/history")
def get_interview_history(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                s.id AS interview_id,
                s.interview_mode,
                s.role,
                s.topics,
                s.status,
                s.created_at,

                COUNT(DISTINCT a.question_id) AS attempted,

                COUNT(DISTINCT CASE
                    WHEN a.is_correct = 1
                    THEN a.question_id
                END) AS correct_answers,

                AVG(a.score) AS average_score

            FROM interview_sessions AS s

            LEFT JOIN interview_answers AS a
                ON s.id = a.interview_id
                AND s.user_id = a.user_id

            WHERE s.user_id = %s
              AND s.interview_mode IN (
                  'mcq_practice',
                  'mock_interview'
              )

            GROUP BY
                s.id,
                s.interview_mode,
                s.role,
                s.topics,
                s.status,
                s.created_at

            ORDER BY s.created_at DESC
            """,
            (user_id,)
        )

        records = cursor.fetchall()

        mcq_history = []
        mock_history = []

        for record in records:

            attempted = record["attempted"] or 0

            if record["interview_mode"] == "mcq_practice":

                correct = record["correct_answers"] or 0

                score = correct
                score_out_of = 5
                percentage = round((correct / 5) * 100, 2)

                mcq_history.append({
                    "interview_id": record["interview_id"],
                    "topic": record["topics"],
                    "date": record["created_at"],
                    "status": record["status"],
                    "attempted": attempted,
                    "total_questions": 5,
                    "correct_answers": correct,
                    "score": score,
                    "score_out_of": score_out_of,
                    "percentage": percentage
                })

            elif record["interview_mode"] == "mock_interview":

                average_score = record["average_score"]

                mock_history.append({
                    "interview_id": record["interview_id"],
                    "role": record["role"],
                    "topic": record["topics"],
                    "date": record["created_at"],
                    "status": record["status"],
                    "attempted": attempted,
                    "total_questions": 5,
                    "average_score": (
                        round(float(average_score), 2)
                        if average_score is not None
                        else None
                    )
                })

        return {
            "user_id": user_id,
            "mcq_practice_history": mcq_history,
            "mock_interview_history": mock_history
        }

    except mysql.connector.Error as db_error:
        print("History database error:", str(db_error))

        raise HTTPException(
            status_code=500,
            detail="Database error while fetching interview history"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None and db.is_connected():
            db.close()

# Get Detailed Report for an Interview Attempt
@app.get("/interviews/{interview_id}/details")
def get_interview_details(
    interview_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        # STEP 1: Verify session ownership
        cursor.execute(
            """
            SELECT id, role, topics, interview_mode,
                   status, created_at
            FROM interview_sessions
            WHERE id = %s AND user_id = %s
            """,
            (interview_id, user_id)
        )

        interview = cursor.fetchone()

        if interview is None:
            raise HTTPException(
                status_code=404,
                detail="Interview session not found"
            )

        if interview["interview_mode"] not in [
            "mcq_practice",
            "mock_interview"
        ]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported interview mode"
            )

        # STEP 2: Fetch submitted answers and questions
        cursor.execute(
            """
            SELECT
                ia.id AS answer_id,
                ia.question_id,
                iq.question_text,
                iq.question_type,
                iq.options,
                iq.correct_answer,
                iq.reference_answer,
                ia.user_answer,
                ia.is_correct,
                ia.ai_feedback,
                ia.score,
                ia.answered_at

            FROM interview_answers AS ia

            INNER JOIN interview_questions AS iq
                ON ia.question_id = iq.id

            WHERE ia.interview_id = %s
              AND ia.user_id = %s

            ORDER BY iq.id ASC
            """,
            (interview_id, user_id)
        )

        answers = cursor.fetchall()

        detailed_answers = []

        for answer in answers:

            if answer["question_type"] == "mcq":

                options = answer["options"]

                if isinstance(options, str):
                    options = json.loads(options) if options else {}

                detailed_answers.append({
                    "question_id": answer["question_id"],
                    "question": answer["question_text"],
                    "options": options,
                    "your_answer": answer["user_answer"],
                    "is_correct": answer["is_correct"],
                    "correct_answer": (
                        answer["correct_answer"]
                        if interview["status"] == "completed"
                        else None
                    ),
                    "explanation": (
                        answer["reference_answer"]
                        if interview["status"] == "completed"
                        else None
                    ),
                    "answered_at": answer["answered_at"]
                })

            elif answer["question_type"] == "text":

                try:
                    feedback = (
                        json.loads(answer["ai_feedback"])
                        if answer["ai_feedback"]
                        else None
                    )
                except (json.JSONDecodeError, TypeError):
                    feedback = None

                detailed_answers.append({
                    "question_id": answer["question_id"],
                    "question": answer["question_text"],
                    "your_answer": answer["user_answer"],
                    "score": answer["score"],
                    "evaluation": feedback,
                    "answered_at": answer["answered_at"]
                })

        return {
            "interview_id": interview["id"],
            "interview_mode": interview["interview_mode"],
            "role": (
                interview["role"]
                if interview["interview_mode"] == "mock_interview"
                else None
            ),
            "topic": interview["topics"],
            "status": interview["status"],
            "date": interview["created_at"],
            "total_attempted": len(detailed_answers),
            "total_questions": 5,
            "questions": detailed_answers
        }

    except HTTPException:
        raise

    except (mysql.connector.Error, json.JSONDecodeError) as error:
        print("Interview details error:", str(error))

        raise HTTPException(
            status_code=500,
            detail="Error while fetching interview details"
        )

    finally:
        cursor.close()
        db.close()
