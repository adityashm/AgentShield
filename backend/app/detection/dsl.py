"""
backend/app/detection/dsl.py — Safe JSON-DSL Rule Evaluation AST Engine.
Evaluates complex policy conditions without using eval() or exec().
Includes ReDoS safety guards and semantic field aliases.
"""

import re
import math
from typing import Any, Dict, List, Optional, Union
from functools import lru_cache

# Shannon entropy calculation
def calculate_entropy(data: str) -> float:
    """Calculates Shannon entropy of a string (useful for secret/ciphertext detection)."""
    if not data:
        return 0.0
    freq: Dict[str, int] = {}
    for c in data:
        freq[c] = freq.get(c, 0) + 1
    entropy = 0.0
    length = len(data)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy

# ReDoS safety guard: verify pattern does not exhibit dangerous nested quantifiers
DANGEROUS_QUANTIFIERS = re.compile(r"(\([^\)]*[\*\+\?][^\)]*\)[\*\+\?])")

@lru_cache(maxsize=1024)
def get_safe_compiled_regex(pattern: str, ignore_case: bool = True) -> Optional[re.Pattern]:
    """Compiles regex with ReDoS check and caching."""
    if len(pattern) > 500:
        return None
    # Basic structural check against catastrophic backtracking
    if DANGEROUS_QUANTIFIERS.search(pattern):
        # Disarm nested quantifier by replacing with single quantifier
        pattern = re.sub(r"[\*\+]\)", ")", pattern)
    try:
        flags = re.IGNORECASE if ignore_case else 0
        return re.compile(pattern, flags)
    except re.error:
        return None

class SafeASTEvaluator:
    """Recursive evaluator for JSON-DSL rule condition trees."""

    SEMANTIC_ALIASES = {
        "parameters.prompt": ["prompt", "user_input", "input", "query", "text", "message", "instruction", "content"],
        "parameters.path": ["path", "file_path", "filepath", "filename", "doc_path", "target", "file"],
        "parameters.command": ["command", "cmd", "shell_command", "script", "exec", "code"],
        "parameters.code": ["code", "script", "snippet", "python", "js"],
    }

    @classmethod
    def evaluate(cls, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Main entry point for condition evaluation.
        Supports both modern AST nodes and legacy flat condition dicts.
        """
        if not condition or not isinstance(condition, dict):
            return False

        op = condition.get("op") or condition.get("operator")
        if not op:
            return False
        op = str(op).lower()

        # Logical Combinators
        if op == "and":
            rules = condition.get("rules", [])
            if not rules:
                return False
            return all(cls.evaluate(r, context) for r in rules)

        if op == "or":
            rules = condition.get("rules", [])
            if not rules:
                return False
            return any(cls.evaluate(r, context) for r in rules)

        if op == "not":
            rule = condition.get("rule", {})
            return not cls.evaluate(rule, context)

        # Field Extraction
        field = condition.get("field", "")
        actual_val = cls.get_field_value(context, field)

        # Leaf Operators
        return cls._eval_leaf(op, actual_val, condition)

    @classmethod
    def get_field_value(cls, context: Dict[str, Any], path: str) -> Any:
        """Retrieves a value from nested context by dot-separated path, with semantic aliases."""
        if not path:
            return None

        # Check semantic aliases for parameter fields
        if path in cls.SEMANTIC_ALIASES:
            params = context.get("parameters", {})
            if isinstance(params, dict):
                for alias in cls.SEMANTIC_ALIASES[path]:
                    if alias in params and params[alias] is not None:
                        return params[alias]

        parts = path.split(".")
        current = context
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    @classmethod
    def _eval_leaf(cls, op: str, actual_val: Any, node: Dict[str, Any]) -> bool:
        if actual_val is None:
            return False

        # Equality
        if op in ("equals", "=="):
            target = node.get("value")
            return str(actual_val).strip().lower() == str(target).strip().lower()

        if op in ("not_equals", "!="):
            target = node.get("value")
            return str(actual_val).strip().lower() != str(target).strip().lower()

        # Numeric / Ordered comparisons
        if op in ("greater_than", ">", "gt"):
            target = float(node.get("value", node.get("threshold", 0)))
            try:
                return float(actual_val) > target
            except (ValueError, TypeError):
                return False

        if op in ("greater_than_or_equal", ">=", "gte"):
            target = float(node.get("value", node.get("threshold", 0)))
            try:
                return float(actual_val) >= target
            except (ValueError, TypeError):
                return False

        if op in ("less_than", "<", "lt"):
            target = float(node.get("value", node.get("threshold", 0)))
            try:
                return float(actual_val) < target
            except (ValueError, TypeError):
                return False

        if op in ("less_than_or_equal", "<=", "lte"):
            target = float(node.get("value", node.get("threshold", 0)))
            try:
                return float(actual_val) <= target
            except (ValueError, TypeError):
                return False

        # Membership
        if op == "in":
            targets = [str(x).lower() for x in node.get("values", [node.get("value")])]
            return str(actual_val).lower() in targets

        if op == "not_in":
            targets = [str(x).lower() for x in node.get("values", [node.get("value")])]
            return str(actual_val).lower() not in targets

        # Substring / String Matching
        actual_str = str(actual_val).lower()

        if op in ("contains", "icontains"):
            target = str(node.get("value", "")).lower()
            return target in actual_str if target else False

        if op == "contains_any":
            targets = [str(x).lower() for x in node.get("values", [])]
            return any(t in actual_str for t in targets)

        if op == "contains_all":
            targets = [str(x).lower() for x in node.get("values", [])]
            return all(t in actual_str for t in targets)

        if op == "starts_with":
            target = str(node.get("value", "")).lower()
            return actual_str.startswith(target)

        if op == "ends_with":
            target = str(node.get("value", "")).lower()
            return actual_str.endswith(target)

        # Regex Match (bounded execution)
        if op in ("regex_match", "matches_regex"):
            pattern = node.get("pattern", node.get("value", ""))
            if not pattern:
                return False
            compiled = get_safe_compiled_regex(pattern)
            if not compiled:
                return False
            # Bound input string to 65536 chars
            bounded_text = str(actual_val)[:65536]
            return bool(compiled.search(bounded_text))

        # Entropy Threshold
        if op == "has_entropy_above":
            threshold = float(node.get("threshold", node.get("value", 4.5)))
            return calculate_entropy(str(actual_val)) >= threshold

        # Length Threshold
        if op == "length_gt":
            threshold = int(node.get("value", 100))
            return len(str(actual_val)) > threshold

        return False
