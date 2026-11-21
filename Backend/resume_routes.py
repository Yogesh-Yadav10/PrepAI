
# ==========================================
# PrepAI - Resume Analysis Routes
# ==========================================
import json  # AI analysis ko JSON format mein database mein save karne ke liye
from pathlib import Path
import uuid
# Groq AI se resume analyze karne wala function
from resume_analyzer import analyze_resume

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    UploadFile,
    File
)

from fastapi.security import HTTPAuthorizationCredentials

# Existing database aur JWT functions reuse karna
from resume_dependencies import (
    get_db_connection,
    verify_access_token,
    security
)

# Resume se text extract karna
from resume_parser import extract_resume_text


# Resume APIs ke liye separate router
router = APIRouter(
    prefix="/resumes",
    tags=["Resume Analysis"]
)


# Resume files save karne ka folder
RESUME_UPLOAD_DIR = (
    Path(__file__).resolve().parent
    / "uploads"
    / "resumes"
)

# Folder automatically create karna
RESUME_UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# 1RESUME UPLOAD API

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # JWT token verify karke logged-in user ki ID nikalna
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None
    saved_file_path = None
    upload_committed = False

    try:
        # Original filename ko safely handle karna
        original_filename = (
            (file.filename or "").replace("\\", "/").split("/")[-1]
        )

        extension = Path(original_filename).suffix.lower()

        # Sirf PDF aur DOCX allow karna
        if extension not in {".pdf", ".docx"}:
            raise HTTPException(
                status_code=400,
                detail="Only PDF and DOCX files are allowed."
            )

        if not original_filename:
            raise HTTPException(
                status_code=400,
                detail="Filename is missing."
            )

        # Maximum file size 5 MB
        max_file_size = 5 * 1024 * 1024

        file_content = await file.read(max_file_size + 1)

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty."
            )

        if len(file_content) > max_file_size:
            raise HTTPException(
                status_code=413,
                detail="Resume file size must not exceed 5 MB."
            )

        # Basic file signature check
        if extension == ".pdf" and not file_content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file."
            )

        if extension == ".docx" and not file_content.startswith(b"PK"):
            raise HTTPException(
                status_code=400,
                detail="Invalid DOCX file."
            )

        # Resume se text extract karna
        try:
            extracted_text = extract_resume_text(
                file_content,
                original_filename
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error)
            )

        # Unique filename generate karna
        stored_filename = f"{uuid.uuid4().hex}{extension}"

        # Resume ko uploads/resumes folder mein save karna
        saved_file_path = RESUME_UPLOAD_DIR / stored_filename
        saved_file_path.write_bytes(file_content)

        # MySQL connection
        db = get_db_connection()
        cursor = db.cursor()

        # Resume details database mein save karna
        cursor.execute(
            """
            INSERT INTO resumes (
                user_id,
                original_filename,
                stored_filename,
                file_path,
                file_type,
                file_size,
                extracted_text
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                original_filename,
                stored_filename,
                str(saved_file_path),
                extension.lstrip("."),
                len(file_content),
                extracted_text
            )
        )

        resume_id = cursor.lastrowid

        # Database changes save karna
        db.commit()
        upload_committed = True

        return {
            "message": "Resume uploaded successfully.",
            "resume_id": resume_id,
            "user_id": user_id,
            "original_filename": original_filename,
            "file_type": extension.lstrip("."),
            "file_size": len(file_content),
            "extracted_text_length": len(extracted_text),
            "status": "uploaded"
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except Exception as error:
        if db is not None:
            db.rollback()

        print("Resume upload error:", error)

        raise HTTPException(
            status_code=500,
            detail="Something went wrong while uploading resume."
        )

    finally:
        # Database save fail hua toh incomplete file delete karna
        if saved_file_path is not None and not upload_committed:
            saved_file_path.unlink(missing_ok=True)

        # Database resources close karna
        if cursor is not None:
            cursor.close()

        if db is not None:
            db.close()

        await file.close()



# 2.RESUME AI ANALYSIS API
@router.post("/{resume_id}/analyze")
def analyze_uploaded_resume(
    resume_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Logged-in user ki ID verify karna
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        # Database connection
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Sirf logged-in user ka resume fetch karna
        cursor.execute(
            """
            SELECT id, extracted_text
            FROM resumes
            WHERE id = %s AND user_id = %s
            """,
            (resume_id, user_id)
        )

        resume = cursor.fetchone()

        if not resume:
            raise HTTPException(
                status_code=404,
                detail="Resume not found."
            )

        resume_text = resume["extracted_text"]

        if not resume_text or not resume_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No extracted resume text available."
            )

        # Groq AI se resume analyze karna
        try:
            analysis = analyze_resume(resume_text)

        except Exception as error:
            print("Resume AI analysis error:", error)

            raise HTTPException(
                status_code=503,
                detail="Resume AI analysis is currently unavailable."
            )

        # Analysis ko JSON format mein database mein save karna
        analysis_json = json.dumps(
            analysis,
            ensure_ascii=False
        )

        cursor.execute(
            """
            UPDATE resumes
            SET analysis_result = %s
            WHERE id = %s AND user_id = %s
            """,
            (analysis_json, resume_id, user_id)
        )

        db.commit()

        return {
            "message": "Resume analyzed successfully.",
            "resume_id": resume_id,
            "analysis": analysis
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except Exception as error:
        if db is not None:
            db.rollback()

        print("Resume analysis API error:", error)

        raise HTTPException(
            status_code=500,
            detail="Something went wrong during resume analysis."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None:
            db.close()




# 3. RESUME HISTORY API
@router.get("/history")
def get_resume_history(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Logged-in user ki ID verify karna
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        # Database connection
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Sirf current user ke resumes fetch karna
        cursor.execute(
            """
            SELECT
                id,
                original_filename,
                file_type,
                file_size,
                created_at,
                updated_at,
                analysis_result
            FROM resumes
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,)
        )

        resumes = cursor.fetchall()

        # Response ke liye data prepare karna
        resume_history = []

        for resume in resumes:

            analysis_result = resume["analysis_result"]

            # Stored JSON ko Python dictionary mein convert karna
            if analysis_result:
                try:
                    analysis_result = json.loads(analysis_result)
                except (json.JSONDecodeError, TypeError):
                    analysis_result = None

            resume_history.append({
                "resume_id": resume["id"],
                "original_filename": resume["original_filename"],
                "file_type": resume["file_type"],
                "file_size": resume["file_size"],
                "created_at": resume["created_at"],
                "updated_at": resume["updated_at"],
                "analysis_completed": analysis_result is not None,
                "resume_score": (
                    analysis_result.get("resume_score")
                    if analysis_result else None
                )
            })

        return {
            "message": "Resume history fetched successfully.",
            "total_resumes": len(resume_history),
            "resumes": resume_history
        }

    except Exception as error:
        print("Resume history error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to fetch resume history."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None:
            db.close()



# 4. RESUME DETAIL API

@router.get("/{resume_id}")
def get_resume_details(
    resume_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Logged-in user ki ID verify karna
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None

    try:
        # Database connection
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Sirf current user ka selected resume fetch karna
        cursor.execute(
            """
            SELECT
                id,
                original_filename,
                file_type,
                file_size,
                extracted_text,
                analysis_result,
                created_at,
                updated_at
            FROM resumes
            WHERE id = %s AND user_id = %s
            """,
            (resume_id, user_id)
        )

        resume = cursor.fetchone()

        # Resume nahi mila ya doosre user ka hai
        if not resume:
            raise HTTPException(
                status_code=404,
                detail="Resume not found."
            )

        # Stored AI analysis ko JSON mein convert karna
        analysis_result = resume["analysis_result"]

        if analysis_result:
            try:
                analysis_result = json.loads(analysis_result)
            except (json.JSONDecodeError, TypeError):
                analysis_result = None

        return {
            "message": "Resume details fetched successfully.",
            "resume": {
                "resume_id": resume["id"],
                "original_filename": resume["original_filename"],
                "file_type": resume["file_type"],
                "file_size": resume["file_size"],
                "extracted_text": resume["extracted_text"],
                "analysis": analysis_result,
                "created_at": resume["created_at"],
                "updated_at": resume["updated_at"]
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Resume detail error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to fetch resume details."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None:
            db.close()



# 5: DELETE RESUME API del old resume data

@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Logged-in user ki ID verify karna
    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    db = None
    cursor = None
    file_to_delete = None

    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Sirf current user ka resume fetch karna
        cursor.execute(
            """
            SELECT id, stored_filename
            FROM resumes
            WHERE id = %s AND user_id = %s
            """,
            (resume_id, user_id)
        )

        resume = cursor.fetchone()

        if not resume:
            raise HTTPException(
                status_code=404,
                detail="Resume not found."
            )

        # Stored filename se safe file path banana
        stored_filename = resume["stored_filename"]

        if stored_filename != Path(stored_filename).name:
            raise HTTPException(
                status_code=500,
                detail="Invalid stored resume filename."
            )

        file_to_delete = RESUME_UPLOAD_DIR / stored_filename

        # Database se resume delete karna
        cursor.execute(
            """
            DELETE FROM resumes
            WHERE id = %s AND user_id = %s
            """,
            (resume_id, user_id)
        )

        db.commit()

        # Database delete successful hone ke baad file delete karna
        file_to_delete.unlink(missing_ok=True)

        return {
            "message": "Resume deleted successfully.",
            "resume_id": resume_id
        }

    except HTTPException:
        if db is not None:
            db.rollback()
        raise

    except Exception as error:
        if db is not None:
            db.rollback()

        print("Resume delete error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to delete resume."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if db is not None:
            db.close()
