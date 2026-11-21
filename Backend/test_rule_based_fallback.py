"""Test PrepAI's rule-based evaluator against an imported Python interview question."""

import os
import json
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

from fallback_evaluator import evaluate_answer_without_ai


# Load database settings from Backend/.env; defaults match the current project setup.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root"),
        database=os.getenv("DB_NAME", "prepai_db"),
    )


def main():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        # Only fetch a newly imported fallback question with its expected concepts.
        cursor.execute(
            """
            SELECT id, role, topic, question_text, reference_answer
            FROM interview_questions
            WHERE role = %s
              AND question_type = 'text'
              AND source = 'fallback'
            ORDER BY id
            LIMIT 1
            """,
            ("Python Developer",),
        )
        question = cursor.fetchone()

        if question is None:
            raise RuntimeError(
                "No imported Python fallback question found. Check the question import."
            )

        # This sample answer intentionally covers the first two concepts,
        # but does not explain that two distinct objects can have equal values.
        candidate_answer = (
            "The == operator compares values for equality. "
            "The is operator checks object identity, meaning whether two "
            "references point to the same object in memory."
        )

        evaluation = evaluate_answer_without_ai(
            candidate_answer=candidate_answer,
            reference_answer=question["reference_answer"],
        )

        print("RULE-BASED FALLBACK TEST SUCCESSFUL")
        print("=" * 48)
        print("Question ID:", question["id"])
        print("Role:", question["role"])
        print("Question:", question["question_text"])
        print("\nCandidate Answer:", candidate_answer)
        print("\nEvaluation Type:", evaluation["evaluation_type"])
        print("Score:", evaluation["score"], "/ 100")
        print(
            "Concept Coverage:",
            evaluation["covered_concepts"],
            "/",
            evaluation["total_expected_concepts"],
        )

        print("\nStrengths:")
        for item in evaluation["strengths"]:
            print("-", item)

        print("\nMissing Concepts:")
        for item in evaluation["missing_concepts"]:
            print("-", item)

        print("\nImprovement Suggestions:")
        for item in evaluation["improvement_suggestions"]:
            print("-", item)

        print("\nOverall Feedback:")
        print(evaluation["overall_feedback"])

    finally:
        cursor.close()
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("\nFallback test failed:", error)
        raise SystemExit(1)
