
"""Reusable, non-LLM evaluator for PrepAI descriptive questions."""

import json
import re
from typing import Any


IGNORED_STANDALONE_KEYWORDS = {
    "is", "are", "was", "were", "be", "been", "being",
    "get", "post", "put", "delete", "do", "does", "did",
    "the", "and", "for", "with", "from", "into", "this", "that",
}

# Common words removed while extracting concepts from plain-text references.
STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "this", "that",
    "these", "those", "their", "there", "then", "than", "they",
    "them", "when", "where", "which", "while", "what", "why",
    "how", "who", "whose", "have", "has", "had", "will", "would",
    "should", "could", "can", "may", "might", "must", "also",
    "very", "more", "most", "some", "such", "each", "every",
    "both", "other", "another", "only", "same", "used", "using",
    "use", "uses", "example", "examples", "like", "such", "than",
    "its", "their", "about", "after", "before", "between",
    "being", "been", "because", "through", "during", "without",
    "within", "into", "onto", "over", "under", "here", "there",
    "not", "but", "are", "was", "were", "is", "am", "be",
    "to", "of", "in", "on", "at", "by", "as", "an", "a",
    "or", "if", "it", "we", "you", "he", "she", "they",
    "i", "me", "my", "your", "our", "his", "her",
}

OPERATORS = {"==", "!=", "<=", ">=", "<", ">", "="}


def _keyword_is_present(answer: str, keyword: str) -> bool:
    """Match a keyword as a whole word or phrase."""

    keyword = keyword.strip().casefold()

    if not keyword:
        return False

    if keyword in OPERATORS:
        return keyword in answer

    if keyword in IGNORED_STANDALONE_KEYWORDS:
        return False

    if len(keyword) <= 3:
        pattern = rf"(?<!\w){re.escape(keyword)}(?!\w)"
        return re.search(pattern, answer, flags=re.IGNORECASE) is not None

    words = keyword.split()
    phrase_pattern = r"\s+".join(re.escape(word) for word in words)
    pattern = rf"(?<!\w){phrase_pattern}(?!\w)"

    return re.search(pattern, answer, flags=re.IGNORECASE) is not None


def _extract_plain_text_concepts(
    reference_answer: str,
) -> list[dict[str, Any]]:
    """
    Convert a plain-text reference answer into sentence-level concepts.

    This is a keyword-based heuristic, not semantic understanding.
    """

    if not isinstance(reference_answer, str) or not reference_answer.strip():
        raise ValueError("Plain-text reference answer is empty.")

    # Split reference answer into individual sentences.
    sentences = re.split(
        r"(?<=[.!?])\s+|\n+",
        reference_answer.strip()
    )

    concepts = []

    for sentence in sentences:
        sentence = sentence.strip()

        if not sentence:
            continue

        # Extract meaningful words and technical terms.
        words = re.findall(
            r"[A-Za-z][A-Za-z0-9_+#.-]*",
            sentence.casefold()
        )

        keywords = []

        for word in words:
            cleaned_word = word.strip(".,:;!?()[]{}")

            if (
                len(cleaned_word) >= 4
                and cleaned_word not in STOPWORDS
                and cleaned_word not in keywords
            ):
                keywords.append(cleaned_word)

        # Skip sentences without useful keywords.
        if not keywords:
            continue

        concepts.append({
            "concept": sentence,
            "keywords": keywords,
        })

    if not concepts:
        raise ValueError(
            "Could not extract meaningful concepts from the reference answer."
        )

    return concepts


def _load_reference_data(
    reference_answer: str | dict[str, Any],
) -> tuple[list[dict[str, Any]], str]:
    """
    Support both:
    1. Legacy JSON expected_concepts.
    2. Plain-text Groq-generated reference answers.
    """

    if isinstance(reference_answer, dict):
        reference_data = reference_answer

    elif isinstance(reference_answer, str):

        if not reference_answer.strip():
            raise ValueError("Reference answer is empty.")

        try:
            reference_data = json.loads(reference_answer)

        except json.JSONDecodeError:
            # Groq-generated plain-text reference answer.
            concepts = _extract_plain_text_concepts(reference_answer)
            return concepts, "rule_based_reference_fallback"

    else:
        raise ValueError(
            "Reference answer must be text or a dictionary."
        )

    if not isinstance(reference_data, dict):
        raise ValueError("Reference data must be a JSON object.")

    concepts = reference_data.get("expected_concepts")

    if not isinstance(concepts, list) or not concepts:
        raise ValueError("No expected concepts found for fallback evaluation.")

    for index, item in enumerate(concepts):

        if not isinstance(item, dict):
            raise ValueError(
                f"Expected concept #{index + 1} must be an object."
            )

        if (
            not isinstance(item.get("concept"), str)
            or not item["concept"].strip()
        ):
            raise ValueError(
                f"Expected concept #{index + 1} has no description."
            )

        if not isinstance(item.get("keywords"), list):
            raise ValueError(
                f"Expected concept #{index + 1} has invalid keywords."
            )

        if not all(isinstance(word, str) for word in item["keywords"]):
            raise ValueError(
                f"Expected concept #{index + 1} keywords must be text."
            )

    return concepts, "rule_based_fallback"


def evaluate_answer_without_ai(
    candidate_answer: str,
    reference_answer: str | dict[str, Any],
) -> dict[str, Any]:
    """
    Evaluate a descriptive answer using the SAME question's reference answer.

    Supports legacy JSON and Groq-generated plain-text references.
    This is an approximate keyword-based fallback, not AI evaluation.
    """

    if not isinstance(candidate_answer, str):
        raise ValueError("Candidate answer must be text.")

    concepts, evaluation_type = _load_reference_data(reference_answer)

    normalized_answer = " ".join(
        candidate_answer.casefold().split()
    )

    matched_concepts = []
    missing_concepts = []

    for item in concepts:

        concept_name = item["concept"].strip()

        matched_keywords = [
            keyword
            for keyword in item["keywords"]
            if _keyword_is_present(normalized_answer, keyword)
        ]

        if matched_keywords:
            matched_concepts.append({
                "concept": concept_name,
                "matched_keywords": matched_keywords,
            })

        else:
            missing_concepts.append(concept_name)

    total_concepts = len(concepts)
    covered_count = len(matched_concepts)

    score = round(
        (covered_count / total_concepts) * 100,
        2
    )

    strengths = [
        f"Covered concept: {item['concept']}"
        for item in matched_concepts
    ]

    weaknesses = [
        f"Not clearly demonstrated: {concept}"
        for concept in missing_concepts
    ]

    suggestions = [
        f"Add a clear explanation of: {concept}"
        for concept in missing_concepts
    ]

    if not candidate_answer.strip():

        overall_feedback = (
            "No answer was provided. Attempt the question with "
            "a relevant explanation."
        )

    elif score >= 80:

        overall_feedback = (
            "The answer covers most expected concepts. "
            "This is an approximate keyword-based fallback score, "
            "not an AI judgement."
        )

    elif score >= 50:

        overall_feedback = (
            "The answer covers some expected concepts, "
            "but important points are missing. "
            "This is an approximate keyword-based fallback score, "
            "not an AI judgement."
        )

    else:

        overall_feedback = (
            "The answer contains limited evidence of expected concepts. "
            "Review the missing concepts and try again. "
            "This is an approximate keyword-based fallback score."
        )

    return {
        "evaluation_type": evaluation_type,
        "score": score,
        "score_out_of": 100,
        "total_expected_concepts": total_concepts,
        "covered_concepts": covered_count,
        "coverage_percent": score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_concepts": missing_concepts,
        "improvement_suggestions": suggestions,
        "overall_feedback": overall_feedback,
    }
