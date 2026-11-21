
"""Groq-based question generator for PrepAI."""

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


MCQ_TOPICS = [
    "OOPs",
    "DBMS",
    "Technical Fundamentals",
    "Operating Systems",
    "Computer Networks",
    "System Design",
    "DSA",
    "Pharma Production & GMP",
]


def _validate_mcq_questions(
    questions: Any,
    topic: str,
) -> list[dict[str, Any]]:

    if not isinstance(questions, list) or len(questions) != 10:
        raise ValueError("Groq must generate exactly 10 MCQs.")

    validated = []

    for index, question in enumerate(questions, start=1):

        if not isinstance(question, dict):
            raise ValueError(f"Question {index} must be an object.")

        required_fields = [
            "question_text",
            "options",
            "correct_answer",
            "explanation",
        ]

        for field in required_fields:
            if field not in question:
                raise ValueError(
                    f"Question {index} is missing {field}."
                )

        question_text = question["question_text"]
        options = question["options"]
        correct_answer = question["correct_answer"]
        explanation = question["explanation"]

        if not isinstance(question_text, str) or not question_text.strip():
            raise ValueError(f"Question {index} has invalid question text.")

        if not isinstance(options, dict):
            raise ValueError(f"Question {index} options must be an object.")

        if set(options.keys()) != {"A", "B", "C", "D"}:
            raise ValueError(
                f"Question {index} must have exactly A, B, C and D options."
            )

        if not all(
            isinstance(value, str) and value.strip()
            for value in options.values()
        ):
            raise ValueError(f"Question {index} has an empty option.")

        if not isinstance(correct_answer, str):
            raise ValueError(
                f"Question {index} correct_answer must be text."
            )

        correct_answer = correct_answer.strip().upper()

        if correct_answer not in {"A", "B", "C", "D"}:
            raise ValueError(
                f"Question {index} has an invalid correct answer."
            )

        if (
            not isinstance(explanation, str)
            or not explanation.strip()
        ):
            raise ValueError(f"Question {index} has no explanation.")

        validated.append({
            "question_text": question_text.strip(),
            "options": options,
            "correct_answer": correct_answer,
            "explanation": explanation.strip(),
            "topic": topic,
            "question_type": "mcq",
        })

    return validated


def generate_mcq_questions(topic: str) -> list[dict[str, Any]]:
    """
    Generate exactly 10 MCQs for the selected topic.

    AI_PROVIDER=groq:
        Generate questions using Groq.

    AI_PROVIDER=disabled:
        Stop Groq generation so main.py can use MySQL fallback.

    Tries the primary Groq model first, then the configured
    secondary model. Raises RuntimeError if both fail.
    """

    # Check whether Groq generation is enabled
    provider = os.getenv("AI_PROVIDER", "groq").strip().lower()

    if provider != "groq":
        raise RuntimeError(
            "Groq question generation is disabled. Use MySQL fallback."
        )

    if topic not in MCQ_TOPICS:
        raise ValueError("Invalid MCQ topic selected.")

    api_key = os.getenv("GROQ_API_KEY")
    primary_model = os.getenv("GROQ_MODEL")
    secondary_model = os.getenv("GROQ_FALLBACK_MODEL")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    models = []

    for model_name in (primary_model, secondary_model):
        if model_name and model_name not in models:
            models.append(model_name)

    if not models:
        raise RuntimeError("No Groq models are configured.")

    timeout_seconds = int(os.getenv("AI_TIMEOUT_SECONDS", "30"))

    client = Groq(
        api_key=api_key,
        timeout=timeout_seconds,
    )

    system_prompt = """
You are an expert technical interviewer creating MCQ practice questions.

Generate exactly 10 original, topic-relevant MCQs for students and freshers.

Rules:
1. Every question must belong to the selected topic.
2. Each question must have exactly four options: A, B, C and D.
3. Only one option must be correct.
4. correct_answer must contain only the option letter: A, B, C or D.
5. Provide a clear explanation of the correct answer.
6. Avoid ambiguous questions and duplicate questions in this response.
7. Questions should have a mixed easy-to-moderate difficulty level.
8. Do not include markdown or text outside the JSON object.

Return ONLY valid JSON in this exact structure:

{
  "questions": [
    {
      "question_text": "Question here",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_answer": "A",
      "explanation": "Explanation here"
    }
  ]
}
"""

    user_prompt = (
        f"Generate exactly 10 MCQs for this topic: {topic}. "
        "Follow every rule and return the required JSON structure."
    )

    errors = []

    for model_name in models:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_completion_tokens=5000,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content

            if not content:
                raise ValueError("Groq returned an empty response.")

            result = json.loads(content)

            if not isinstance(result, dict) or "questions" not in result:
                raise ValueError("Invalid Groq JSON response structure.")

            questions = _validate_mcq_questions(
                result["questions"],
                topic,
            )

            print(
                f"Generated {len(questions)} MCQs using {model_name}"
            )

            return questions

        except Exception as error:
            errors.append(f"{model_name}: {error}")
            print(f"Groq generation failed for {model_name}: {error}")

    raise RuntimeError(
        "All configured Groq models failed question generation. "
        + " | ".join(errors)
    )
