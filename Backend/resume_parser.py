
"""PrepAI: PDF aur DOCX resume se text extract karna."""

from pathlib import Path
from io import BytesIO

import fitz  # PDF read karne ke liye
from docx import Document  # DOCX read karne ke liye


# Sirf ye 2 file formats allow honge
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def extract_resume_text(
    file_content: bytes,
    filename: str
) -> str:
    """
    Resume file se readable text extract karta hai.
    Input: File ka content aur filename
    Output: Extracted resume text
    """

    # Filename se extension nikalna, jaise .pdf ya .docx
    extension = Path(filename).suffix.lower()

    # Unsupported file format ko reject karna
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Unsupported file format. Only PDF and DOCX are allowed."
        )

    # Empty file upload hui toh error dena
    if not file_content:
        raise ValueError("Uploaded resume file is empty.")

    extracted_text = ""

    try:
        # ---------------- PDF FILE ----------------
        if extension == ".pdf":

            # PDF ko memory se open karna, disk par save karna zaroori nahi
            with fitz.open(
                stream=file_content,
                filetype="pdf"
            ) as pdf_document:

                # Password-protected PDF reject karna
                if pdf_document.is_encrypted:
                    raise ValueError(
                        "Password-protected PDF files are not supported."
                    )

                pages = []

                # PDF ke har page se text nikalna
                for page in pdf_document:
                    pages.append(page.get_text("text"))

                # Sabhi pages ka text combine karna
                extracted_text = "\n".join(pages)

        # ---------------- DOCX FILE ----------------
        elif extension == ".docx":

            # DOCX file ko memory se read karna
            document = Document(BytesIO(file_content))

            # Resume ke paragraphs se text nikalna
            paragraphs = [
                paragraph.text
                for paragraph in document.paragraphs
                if paragraph.text.strip()
            ]

            extracted_text = "\n".join(paragraphs)

            # DOCX mein tables bhi ho sakti hain, unka text bhi nikalna
            for table in document.tables:
                for row in table.rows:

                    row_text = [
                        cell.text.strip()
                        for cell in row.cells
                        if cell.text.strip()
                    ]

                    if row_text:
                        extracted_text += "\n" + " | ".join(row_text)

    # Apne validation errors ko same message ke saath return karna
    except ValueError:
        raise

    # File read karte waqt koi unexpected error aaye toh handle karna
    except Exception as error:
        raise ValueError(
            f"Could not read the uploaded resume: {error}"
        ) from error

    # Extra spaces aur blank outer lines remove karna
    extracted_text = extracted_text.strip()

    # Agar readable text nahi mila toh error dena
    if not extracted_text:
        raise ValueError(
            "No readable text found. The resume may be scanned or empty."
        )

    # Final extracted text return karna
    return extracted_text
