#!/usr/bin/env python3
"""Convert the two source DOCX question banks into deterministic JS modules."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from docx import Document


QUESTION_TYPES = ("单选题", "多选题", "判断题", "填空题", "简答题")
OPTION_KEYS = "ABCDEF"
QUESTION_START = re.compile(r"^(\d+)(?:[.．、]\s*|\s+)(.+)$", re.DOTALL)
QUESTION_START_COMPACT = re.compile(r"^(\d+)([^\d\s].+)$", re.DOTALL)
OPTION_LINE = re.compile(r"^([A-F])[.．、]\s*(.*)$", re.IGNORECASE | re.DOTALL)
ANSWER_LINE = re.compile(r"^(?:答案|正确答案)[：:]\s*(.*)$", re.DOTALL)
ANALYSIS_LINE = re.compile(r"^解析[：:]\s*(.*)$", re.DOTALL)
LEGACY_HEADING = re.compile(r"^(单选题|多选题|判断题|填空题|简答题)（(\d+)题）$")
METRO_HEADING = re.compile(r"^(.+?)\s*-\s*(单选题|多选题|判断题|填空题|简答题)$")

KNOWN_REVIEW_ITEMS = {
    ("legacy", "未分级", "判断题", "138"): "题目引用图片，但源 DOCX 未包含图片",
    ("legacy", "未分级", "填空题", "417"): "题目引用图片，但源 DOCX 未包含图片",
    ("legacy", "未分级", "填空题", "418"): "题目引用图片，但源 DOCX 未包含图片",
    ("legacy", "未分级", "填空题", "642"): "原题答案文本疑似截断",
    ("legacy", "未分级", "填空题", "793"): "题目引用图片，但源 DOCX 未包含图片",
    ("legacy", "未分级", "填空题", "805"): "原题题干文本疑似截断",
    ("legacy", "未分级", "填空题", "964"): "原题答案文本疑似截断",
    ("metro", "初级", "单选题", "52"): "源题存在重复选项值，答案含义不明确",
    ("metro", "初级", "单选题", "138"): "题目引用图片，但源 DOCX 未包含图片",
    ("metro", "初级", "填空题", "257"): "数值型题目的源答案疑似残留选项字母",
    ("metro", "初级", "多选题", "4"): "源题存在重复选项值，答案含义不明确",
    ("metro", "中级", "填空题", "81"): "数值型题目的源答案疑似残留选项字母",
    ("metro", "中级", "简答题", "1"): "原题题干和答案存在明显语序损坏",
}


@dataclass
class DraftQuestion:
    number: str
    content: str
    question_type: str
    difficulty: str
    options: dict[str, str] = field(default_factory=dict)
    answer: str = ""
    analysis: str = ""


def clean_text(value: str) -> str:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in normalized.split("\n")]
    return "\n".join(lines).strip()


def match_question_start(text: str) -> re.Match[str] | None:
    return QUESTION_START.match(text) or QUESTION_START_COMPACT.match(text)


def normalize_choice_answer(value: str) -> str:
    letters = [char for char in value.upper() if char in OPTION_KEYS]
    return "".join(dict.fromkeys(letters))


def finish_question(
    draft: DraftQuestion | None,
    *,
    source_name: str,
    source_slug: str,
    sequence: int,
) -> dict | None:
    if draft is None:
        return None

    content = clean_text(draft.content)
    answer = clean_text(draft.answer)
    analysis = clean_text(draft.analysis) or "原题库未提供解析。"
    options = {key: clean_text(value) for key, value in draft.options.items() if clean_text(value)}

    if draft.question_type == "判断题":
        options = {"A": "正确", "B": "错误"}
        if answer in {"正确", "对", "是", "√"}:
            answer = "A"
        elif answer in {"错误", "错", "否", "×"}:
            answer = "B"
        else:
            answer = normalize_choice_answer(answer)
    elif draft.question_type in {"单选题", "多选题"}:
        answer = normalize_choice_answer(answer)

    item = {
        "id": f"{source_slug}-{sequence:04d}",
        "title": f"{source_name} · {draft.question_type} {draft.number}",
        "content": content,
        "answer": answer,
        "analysis": analysis,
        "category": source_name,
        "difficulty": draft.difficulty,
        "type": draft.question_type,
        "source": source_name,
        "source_no": draft.number,
        "grading_mode": (
            "exact"
            if draft.question_type in {"单选题", "多选题", "判断题"}
            else "reference"
            if draft.question_type == "简答题"
            else "normalized_text"
        ),
    }
    review_note = KNOWN_REVIEW_ITEMS.get(
        (source_slug, draft.difficulty, draft.question_type, draft.number)
    )
    if review_note:
        item["import_status"] = "needs_review"
        item["review_note"] = review_note
    for key in OPTION_KEYS:
        if key in options:
            item[f"option_{key.lower()}"] = options[key]
    return item


def parse_document(path: Path, *, source_name: str, source_slug: str) -> tuple[list[dict], dict]:
    document = Document(path)
    paragraphs = [(paragraph.style.name, clean_text(paragraph.text)) for paragraph in document.paragraphs]
    paragraphs = [(style, text) for style, text in paragraphs if text]

    questions: list[dict] = []
    expected_counts: Counter[str] = Counter()
    current_type = ""
    current_difficulty = "未分级"
    current: DraftQuestion | None = None
    active = False
    skipped_lines: list[str] = []

    def flush() -> None:
        nonlocal current
        item = finish_question(
            current,
            source_name=source_name,
            source_slug=source_slug,
            sequence=len(questions) + 1,
        )
        if item:
            questions.append(item)
        current = None

    for style, text in paragraphs:
        legacy_heading = LEGACY_HEADING.match(text)
        metro_heading = METRO_HEADING.match(text)
        if legacy_heading:
            flush()
            current_type = legacy_heading.group(1)
            current_difficulty = "未分级"
            expected_counts[current_type] += int(legacy_heading.group(2))
            active = True
            continue
        if metro_heading:
            flush()
            current_difficulty = clean_text(metro_heading.group(1))
            current_type = metro_heading.group(2)
            active = True
            continue
        if style == "Heading 1" and text == "参考资料":
            flush()
            active = False
            continue
        if not active or text == f"[{current_type}]":
            continue

        question_match = match_question_start(text)
        if question_match and (current is None or current.answer or current.analysis):
            flush()
            current = DraftQuestion(
                number=question_match.group(1),
                content=question_match.group(2),
                question_type=current_type,
                difficulty=current_difficulty,
            )
            continue

        if current is None:
            skipped_lines.append(text)
            continue

        option_match = OPTION_LINE.match(text)
        if option_match and not current.answer:
            current.options[option_match.group(1).upper()] = option_match.group(2)
            continue

        answer_match = ANSWER_LINE.match(text)
        if answer_match:
            current.answer = answer_match.group(1)
            continue

        analysis_match = ANALYSIS_LINE.match(text)
        if analysis_match:
            current.analysis = analysis_match.group(1)
            continue

        if not current.answer:
            if current.question_type == "简答题" and re.fullmatch(r"[a-f]", text, re.IGNORECASE):
                continue
            if current.options:
                last_key = next(reversed(current.options))
                current.options[last_key] = f"{current.options[last_key]} {text}"
            else:
                current.content = f"{current.content} {text}"
        elif not current.analysis:
            current.answer = f"{current.answer} {text}"
        else:
            current.analysis = f"{current.analysis} {text}"

    flush()

    issues: list[str] = []
    ids = [item["id"] for item in questions]
    if len(ids) != len(set(ids)):
        issues.append("duplicate generated ids")

    for item in questions:
        if not item["content"]:
            issues.append(f"{item['id']}: empty content")
        if not item["answer"]:
            issues.append(f"{item['id']}: empty answer")
        option_keys = [key[-1].upper() for key in item if key.startswith("option_")]
        if item["type"] in {"单选题", "多选题", "判断题"}:
            if len(option_keys) < 2:
                issues.append(f"{item['id']}: choice question has fewer than two options")
            missing = [key for key in item["answer"] if key not in option_keys]
            if missing:
                issues.append(f"{item['id']}: answer references missing options {missing}")
        if item["type"] == "单选题" and len(item["answer"]) != 1:
            issues.append(f"{item['id']}: single-choice answer is {item['answer']!r}")
        if item["type"] == "判断题" and item["answer"] not in {"A", "B"}:
            issues.append(f"{item['id']}: judgment answer is {item['answer']!r}")

    actual_counts = Counter(item["type"] for item in questions)
    for question_type, expected in expected_counts.items():
        actual = actual_counts[question_type]
        if actual != expected:
            issues.append(f"{question_type}: expected {expected}, parsed {actual}")

    duplicate_content_count = len(questions) - len({item["content"] for item in questions})
    report = {
        "source": source_name,
        "path": str(path),
        "total": len(questions),
        "by_type": dict(sorted(actual_counts.items())),
        "by_difficulty": dict(sorted(Counter(item["difficulty"] for item in questions).items())),
        "duplicate_content_count": duplicate_content_count,
        "ready_count": sum(item.get("import_status") != "needs_review" for item in questions),
        "needs_review_count": sum(item.get("import_status") == "needs_review" for item in questions),
        "skipped_lines": skipped_lines,
        "issues": issues,
    }
    return questions, report


def write_js_module(path: Path, export_name: str, questions: list[dict], source_path: Path) -> None:
    payload = json.dumps(questions, ensure_ascii=False, indent=2)
    header = (
        "// Generated by scripts/import_docx_questions.py.\n"
        f"// Source: {source_path.name}\n"
        "// Re-run the importer instead of editing this file by hand.\n\n"
    )
    path.write_text(f"{header}export const {export_name} = {payload}\n", encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy", type=Path, required=True)
    parser.add_argument("--metro", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    specs = [
        (args.legacy, "老题库", "legacy", "legacyQuestions", "legacy-questions.js"),
        (args.metro, "地铁智学", "metro", "metroQuestions", "metro-questions.js"),
    ]
    reports = []
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for source_path, source_name, source_slug, export_name, output_name in specs:
        questions, report = parse_document(
            source_path,
            source_name=source_name,
            source_slug=source_slug,
        )
        reports.append(report)
        write_js_module(args.output_dir / output_name, export_name, questions, source_path)

    print(json.dumps(reports, ensure_ascii=False, indent=2))
    if any(report["issues"] for report in reports):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
