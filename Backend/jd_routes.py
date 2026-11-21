
from pathlib import Path

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    UploadFile,
    File,
    Form,
)
from fastapi.security import HTTPAuthorizationCredentials

from resume_dependencies import (
    get_db_connection,
    verify_access_token,
    security,
)
from resume_parser import extract_resume_text
from jd_parser import extract_jd_text
from jd_analyzer import analyze_jd_and_resume


router = APIRouter(
    prefix="/jd-analysis",
    tags=["JD Analysis"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("/evaluate")
async def evaluate_jd(
    jd_file: UploadFile | None = File(default=None),
    jd_text: str | None = Form(default=None),
    resume_id: int | None = Form(default=None),
    resume_file: UploadFile | None = File(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    JD ko existing saved resume ya newly uploaded resume
    ke saath compare karna. JD evaluation database mein save nahi hota.
    """

    payload = verify_access_token(credentials)
    user_id = int(payload["sub"])

    connection = None
    cursor = None

    try:
        # -----------------------------------------
        # 1. Validate JD source
        # -----------------------------------------

        has_jd_file = jd_file is not None
        has_jd_text = bool(jd_text and jd_text.strip())

        if has_jd_file == has_jd_text:
            raise HTTPException(
                status_code=400,
                detail="Provide either a JD file or JD text, not both."
            )

        jd_filename = None

        if jd_file:
            jd_filename = Path(jd_file.filename).name
            jd_extension = Path(jd_filename).suffix.lower()

            if jd_extension not in (".pdf", ".docx", ".txt"):
                raise HTTPException(
                    status_code=400,
                    detail="JD must be PDF, DOCX or TXT."
                )

            jd_content = await jd_file.read()

            if not jd_content:
                raise HTTPException(
                    status_code=400,
                    detail="JD file is empty."
                )

            if len(jd_content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="JD file must be under 5 MB."
                )

            try:
                extracted_jd = extract_jd_text(
                    jd_content,
                    jd_filename
                )
            except Exception as error:
                print("JD extraction error:", error)
                raise HTTPException(
                    status_code=400,
                    detail="Unable to extract text from JD file."
                )

        else:
            extracted_jd = jd_text.strip()

        if not extracted_jd or not extracted_jd.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found in the JD."
            )

        # -----------------------------------------
        # 2. Validate resume source
        # -----------------------------------------

        has_resume_id = resume_id is not None
        has_resume_file = resume_file is not None

        if has_resume_id == has_resume_file:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Provide either an existing Resume ID "
                    "or upload a new resume."
                )
            )

        resume_source = None
        resume_filename = None
        extracted_resume = None

        # -----------------------------------------
        # 3. Existing saved resume
        # -----------------------------------------

        if resume_id is not None:

            connection = get_db_connection()
            cursor = connection.cursor(dictionary=True)

            cursor.execute(
                """
                SELECT
                    id,
                    original_filename,
                    extracted_text
                FROM resumes
                WHERE id = %s AND user_id = %s
                """,
                (resume_id, user_id)
            )

            resume_record = cursor.fetchone()

            if not resume_record:
                raise HTTPException(
                    status_code=404,
                    detail="Resume not found."
                )

            extracted_resume = resume_record["extracted_text"]
            resume_filename = resume_record["original_filename"]
            resume_source = "saved_resume"

            if not extracted_resume or not extracted_resume.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Saved resume has no readable text."
                )

        # -----------------------------------------
        # 4. New resume upload (not saved in DB)
        # -----------------------------------------

        else:

            resume_filename = Path(resume_file.filename).name
            resume_extension = Path(resume_filename).suffix.lower()

            if resume_extension not in (".pdf", ".docx"):
                raise HTTPException(
                    status_code=400,
                    detail="Resume must be PDF or DOCX."
                )

            resume_content = await resume_file.read()

            if not resume_content:
                raise HTTPException(
                    status_code=400,
                    detail="Resume file is empty."
                )

            if len(resume_content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="Resume file must be under 5 MB."
                )

            try:
                extracted_resume = extract_resume_text(
                    resume_content,
                    resume_filename
                )
            except Exception as error:
                print("Resume extraction error:", error)
                raise HTTPException(
                    status_code=400,
                    detail="Unable to extract text from resume."
                )

            resume_source = "new_upload"

            if not extracted_resume or not extracted_resume.strip():
                raise HTTPException(
                    status_code=400,
                    detail="No readable text found in resume."
                )

        # -----------------------------------------
        # 5. AI evaluation using Groq
        # -----------------------------------------

        try:
            analysis = analyze_jd_and_resume(
                jd_text=extracted_jd,
                resume_text=extracted_resume
            )

        except Exception as error:
            print("JD AI evaluation error:", error)

            raise HTTPException(
                status_code=503,
                detail=(
                    "AI evaluation is temporarily unavailable. "
                    "Please try again later."
                )
            )

        # -----------------------------------------
        # 6. Return result (no database save)
        # -----------------------------------------

        return {
            "message": "JD evaluation completed successfully.",
            "resume_source": resume_source,
            "resume_id": resume_id,
            "resume_filename": resume_filename,
            "jd_filename": jd_filename,
            "analysis": analysis
        }

    except HTTPException:
        raise

    except Exception as error:
        print("JD evaluation endpoint error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to complete JD evaluation."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()
