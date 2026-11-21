import os
from dotenv import load_dotenv
import mysql.connector
import json

load_dotenv()

db = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 3306)),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)

cursor = db.cursor()

try:
    cursor.execute(
        """
        SELECT reference_answer
        FROM interview_questions
        WHERE id = 4 AND question_type = 'text'
        """
    )

    result = cursor.fetchone()

    if result is None:
        raise ValueError("Question ID 4 not found")

    reference_data = json.loads(result[0])

    keywords = reference_data["expected_concepts"][3]["keywords"]

    new_keywords = [
        "accessed using their keys",
        "accessing values using keys",
        "dictionary values using keys"
    ]

    for keyword in new_keywords:
        if keyword not in keywords:
            keywords.append(keyword)

    updated_json = json.dumps(reference_data)

    cursor.execute(
        """
        UPDATE interview_questions
        SET reference_answer = %s
        WHERE id = 4 AND question_type = 'text'
        """,
        (updated_json,)
    )

    db.commit()

    print("Fallback keywords updated successfully!")
    print(keywords)

except Exception as error:
    db.rollback()
    print("Update failed:", error)

finally:
    cursor.close()
    db.close()
