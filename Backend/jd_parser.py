# Job Description parser for PrepAI.

from resume_parser import extract_resume_text


def extract_jd_text(
    file_content: bytes,
    filename: str
) -> str:
    """PDF, DOCX aur TXT se JD text extract karna."""

    extension = filename.lower().rsplit(".", 1)[-1]

    # PDF aur DOCX ke liye existing parser reuse karna
    if extension in ("pdf", "docx"):
        text = extract_resume_text(file_content, filename)

    # TXT file ka text read karna
    elif extension == "txt":
        try:
            text = file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("Invalid TXT file encoding.")

    else:
        raise ValueError(
            "Only PDF, DOCX and TXT files are supported for JD."
        )

    # Empty JD reject karna
    if not text or not text.strip():
        raise ValueError("Job description contains no readable text.")

    return text.strip()
