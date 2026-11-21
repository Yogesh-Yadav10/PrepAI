
"""Groq-based role-specific Mock Interview question generator for PrepAI."""

import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


MOCK_ROLES = [
    "Python Developer",
    "Java Developer",
    "AI/ML Engineer",
    "Full Stack Developer",
    "Pharma Production",
]


def _extract_questions(content: str) -> list:
    """Read the questions list from common valid JSON response shapes."""

    if not isinstance(content, str) or not content.strip():
        raise ValueError("Groq returned an empty response.")

    cleaned = content.strip()

    # Remove Markdown code fences if the model adds them.
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        first_object = cleaned.find("{")
        first_array = cleaned.find("[")
        starts = [p for p in (first_object, first_array) if p >= 0]

        if not starts:
            raise ValueError("Groq response did not contain valid JSON.")

        start = min(starts)
        last_object = cleaned.rfind("}")
        last_array = cleaned.rfind("]")
        end = max(last_object, last_array)

        if end < start:
            raise ValueError("Groq response contained incomplete JSON.")

        result = json.loads(cleaned[start:end + 1])

    if isinstance(result, list):
        questions = result

    elif isinstance(result, dict):
        questions = result.get("questions")

        if questions is None:
            for key in ("data", "result", "interview_questions"):
                nested = result.get(key)

                if isinstance(nested, dict) and isinstance(
                    nested.get("questions"), list
                ):
                    questions = nested["questions"]
                    break

                if isinstance(nested, list):
                    questions = nested
                    break
    else:
        questions = None

    if not isinstance(questions, list):
        raise ValueError(
            "Groq JSON must contain a 'questions' array."
        )

    return questions


def _validate_mock_questions(
    questions: Any,
    role: str,
) -> list[dict[str, Any]]:

    if not isinstance(questions, list) or len(questions) != 5:
        actual_count = len(questions) if isinstance(questions, list) else 0

        raise ValueError(
            f"Expected exactly 5 questions, but Groq returned {actual_count}."
        )

    validated = []

    for index, question in enumerate(questions, start=1):

        if not isinstance(question, dict):
            raise ValueError(
                f"Question {index} must be a JSON object."
            )

        question_text = (
            question.get("question_text")
            or question.get("question")
        )

        reference_answer = (
            question.get("reference_answer")
            or question.get("ideal_answer")
            or question.get("sample_answer")
            or question.get("answer")
        )

        if not isinstance(question_text, str) or not question_text.strip():
            raise ValueError(
                f"Question {index} is missing a valid question_text."
            )

        if (
            not isinstance(reference_answer, str)
            or not reference_answer.strip()
        ):
            raise ValueError(
                f"Question {index} is missing a valid reference_answer."
            )

        validated.append({
            "question_text": question_text.strip(),
            "reference_answer": reference_answer.strip(),
            "role": role,
            "topic": "Role Based",
            "question_type": "text",
        })

    return validated


def generate_mock_questions(
    role: str,
) -> list[dict[str, Any]]:
    """
    Generate exactly 5 role-specific descriptive interview questions.

    AI_PROVIDER=groq:
        Generate questions using Groq.

    AI_PROVIDER=disabled:
        Stop generation so main.py can use MySQL fallback.
    """

    provider = os.getenv("AI_PROVIDER", "groq").strip().lower()

    if provider != "groq":
        raise RuntimeError(
            "Groq Mock Interview generation is disabled. "
            "Use MySQL fallback."
        )

    if role not in MOCK_ROLES:
        raise ValueError("Invalid Mock Interview role selected.")

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
You are an expert interviewer creating a mock interview for a student.

Return one JSON object and nothing else. The object must have exactly
one key named "questions". Its value must be an array containing exactly
5 objects. Every object must contain exactly these two string fields:
"question_text" and "reference_answer".

Generate descriptive, open-ended interview questions. Do not generate
multiple-choice questions. Do not include options, numbering, markdown,
or text outside the JSON object.

All five questions must be distinct and relevant to the supplied role.
Cover important skills, concepts, practical knowledge, and real-world
scenarios relevant to that role.

Each reference_answer must be a useful, accurate sample answer suitable
for evaluating a fresher's response.

Use easy-to-moderate difficulty.
"""

    user_prompt = (
        f"Role: {role}\n\n"
        "Create exactly 5 distinct descriptive mock interview questions "
        "relevant to this role. Cover different important concepts and "
        "practical skills for this role. Provide a detailed reference "
        "answer for each question.\n\n"
        'Required JSON shape: {"questions": [{"question_text": "...", '
        '"reference_answer": "..."}]}\n'
        "The questions array must contain exactly 5 objects."
    )

    errors = []

    for model_name in models:

        for attempt in range(1, 3):

            try:
                request_args = {
                    "model": model_name,
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        },
                    ],
                    "temperature": 0.2,
                    "max_completion_tokens": 6000,
                }

                if attempt == 1:
                    request_args["response_format"] = {
                        "type": "json_object"
                    }

                else:
                    request_args["messages"].append({
                        "role": "user",
                        "content": (
                            "Retry because the previous response was not "
                            "valid. Return ONLY a JSON object with a "
                            '"questions" array containing exactly 5 objects. '
                            'Each object must have "question_text" and '
                            '"reference_answer" string fields. No markdown.'
                        ),
                    })

                response = client.chat.completions.create(**request_args)

                content = response.choices[0].message.content

                raw_questions = _extract_questions(content)

                questions = _validate_mock_questions(
                    raw_questions,
                    role,
                )

                print(
                    f"Generated {len(questions)} role-based Mock Interview "
                    f"questions using {model_name} (attempt {attempt})"
                )

                return questions

            except Exception as error:

                error_message = (
                    f"{model_name}, attempt {attempt}: {error}"
                )

                errors.append(error_message)

                print(
                    "Groq Mock Interview generation failed: "
                    + error_message
                )

    raise RuntimeError(
        "All configured Groq models failed Mock Interview generation. "
        + " | ".join(errors)
    )
