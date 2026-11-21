"""Preview or import PrepAI fallback questions into the existing MySQL table.

Default behavior is a READ-ONLY preview. Pass --import to insert rows.
Existing manual questions are not updated or deleted.
"""

import argparse
import json
import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
QUESTION_BANK_PATH = BASE_DIR / "prepai_fallback_question_bank_v2.json"
INTERVIEW_TOPIC = "General Interview"
MCQ_ROLE = "MCQ Practice"
QUESTION_SOURCE = "fallback"


def load_question_bank():
    if not QUESTION_BANK_PATH.exists():
        raise FileNotFoundError(
            f"Question bank file not found: {QUESTION_BANK_PATH.name}"
        )

    with QUESTION_BANK_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("Question bank root must be a JSON object")

    interview_roles = data.get("interview_roles", {})
    mcq_topics = data.get("mcq_topics", {})

    if len(interview_roles) != 5:
        raise ValueError("Expected exactly 5 interview roles in the question bank")
    if len(mcq_topics) != 8:
        raise ValueError("Expected exactly 8 MCQ topics in the question bank")

    for role_key, role_data in interview_roles.items():
        questions = role_data.get("questions", [])
        if len(questions) != 5:
            raise ValueError(f"Role '{role_key}' must contain exactly 5 questions")

    for topic_key, topic_data in mcq_topics.items():
        questions = topic_data.get("questions", [])
        if len(questions) != 5:
            raise ValueError(f"Topic '{topic_key}' must contain exactly 5 MCQs")

        for question in questions:
            options = question.get("options")
            correct_option = question.get("correct_option")
            if not isinstance(options, dict) or set(options) != {"A", "B", "C", "D"}:
                raise ValueError(f"MCQ {question.get('id')} must have options A, B, C and D")
            if correct_option not in options:
                raise ValueError(f"MCQ {question.get('id')} has an invalid correct_option")

    return data


def build_rows(data):
    rows = []

    # Descriptive fallback questions: expected concepts are saved as JSON
    # in reference_answer so the Python fallback evaluator can read them.
    for role_data in data["interview_roles"].values():
        role_name = role_data["name"]

        for question in role_data["questions"]:
            reference_data = {
                "expected_concepts": question["expected_concepts"],
                "evaluation_note": question.get("evaluation_note", "")
            }

            rows.append((
                role_name,
                INTERVIEW_TOPIC,
                question["question"],
                "text",
                None,
                None,
                json.dumps(reference_data, ensure_ascii=False),
                QUESTION_SOURCE
            ))

    # MCQs: correct_answer stores the OPTION TEXT, not A/B/C/D,
    # because the current answer endpoint compares the submitted text.
    for topic_data in data["mcq_topics"].values():
        topic_name = topic_data["name"]

        for question in topic_data["questions"]:
            options = question["options"]
            correct_answer_text = options[question["correct_option"]]

            rows.append((
                MCQ_ROLE,
                topic_name,
                question["question"],
                "mcq",
                json.dumps(options, ensure_ascii=False),
                correct_answer_text,
                question["explanation"],
                QUESTION_SOURCE
            ))

    if len(rows) != 65:
        raise ValueError(f"Expected 65 rows, prepared {len(rows)}")

    return rows


def get_db_connection():
    """Use .env values when supplied; defaults match the current main.py setup."""
    load_dotenv(BASE_DIR / ".env")

    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root"),
        database=os.getenv("DB_NAME", "prepai_db")
    )


def main():
    parser = argparse.ArgumentParser(
        description="Preview or import PrepAI fallback questions into MySQL."
    )
    parser.add_argument(
        "--import",
        dest="do_import",
        action="store_true",
        help="Actually insert the questions. Without this flag, the script only previews."
    )
    args = parser.parse_args()

    data = load_question_bank()
    rows = build_rows(data)

    db = get_db_connection()
    cursor = db.cursor()
    inserted = 0
    skipped = 0

    try:
        duplicate_check = """
            SELECT id
            FROM interview_questions
            WHERE role = %s
              AND topic = %s
              AND question_text = %s
              AND question_type = %s
            LIMIT 1
        """

        insert_query = """
            INSERT INTO interview_questions
            (role, topic, question_text, question_type,
             options, correct_answer, reference_answer, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """

        print("\nPrepAI fallback question bank")
        print("-" * 45)
        print(f"Prepared rows: {len(rows)} (25 interview + 40 MCQ)")
        print("Mode:", "IMPORT" if args.do_import else "READ-ONLY PREVIEW")

        for row in rows:
            role, topic, question_text, question_type = row[:4]
            cursor.execute(
                duplicate_check,
                (role, topic, question_text, question_type)
            )
            existing = cursor.fetchone()

            if existing:
                skipped += 1
                print(f"SKIP existing id={existing[0]} | {role} | {topic}")
                continue

            if args.do_import:
                cursor.execute(insert_query, row)
                inserted += 1
                print(f"INSERTED | {role} | {topic} | {question_type}")
            else:
                print(f"WOULD INSERT | {role} | {topic} | {question_type}")
                inserted += 1

        if args.do_import:
            db.commit()
            print("\nDatabase import committed.")
        else:
            db.rollback()
            print("\nPreview complete. No rows were inserted.")

        print(f"Rows to insert / inserted: {inserted}")
        print(f"Duplicates skipped: {skipped}")
        if not args.do_import:
            print("To insert after reviewing this preview, run:")
            print("python import_fallback_questions_to_mysql.py --import")

    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("\nQuestion bank import failed:")
        print(error)
        raise SystemExit(1)
