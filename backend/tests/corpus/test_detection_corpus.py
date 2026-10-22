"""
backend/tests/corpus/test_detection_corpus.py — Evaluation on 80-sample Benchmark Corpus.
Tests detection precision and recall across 40 benign actions and 40 attacks (OWASP ASI01-ASI10).
"""

import os
import json
import pytest
from sqlalchemy.orm import Session

from app.detection.rules_engine import RulesEngine
from app.detection.ml import hierarchical_ml_engine
from app.services.scoring import RiskScoringService
from app.core.config import settings

def load_corpus() -> list:
    corpus_path = os.path.join(os.path.dirname(__file__), "samples.json")
    with open(corpus_path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_attack_corpus_precision_and_recall(db: Session):
    # Ensure default rules are present
    RulesEngine.seed_default_rules(db)

    corpus = load_corpus()
    assert len(corpus) == 80, f"Expected 80 samples in corpus, got {len(corpus)}"

    tp = 0  # True Positive: malicious detected as threat (alert/deny)
    fp = 0  # False Positive: benign flagged as threat
    tn = 0  # True Negative: benign allowed
    fn = 0  # False Negative: malicious allowed

    detailed_results = []

    for item in corpus:
        sample_id = item["id"]
        label = item["label"]
        action = item["action"]

        # Run detection pipeline:
        # 1. Rule matching
        matched_rules, rule_severity_score = RulesEngine.evaluate_action(action, db)

        # 2. ML Anomaly scoring
        anomaly_score = hierarchical_ml_engine.predict_anomaly_score(action)

        # Elevate anomaly score if critical rule matched
        if rule_severity_score >= 75.0:
            anomaly_score = max(anomaly_score, 0.85)

        # 3. Risk calculation
        is_blocked = any(getattr(r, "mode", "alert") == "block" and getattr(r, "severity", "medium").upper() in ("CRITICAL", "HIGH") for r in matched_rules)
        risk_score = RiskScoringService.calculate_action_risk(
            rule_severity_score=rule_severity_score,
            anomaly_score=anomaly_score,
            is_blocked=is_blocked,
        )

        # Decision
        is_detected = (
            risk_score >= settings.ALERT_THRESHOLD
            or len(matched_rules) > 0
            or anomaly_score >= settings.ANOMALY_HIGH_THRESHOLD
        )

        if label == "malicious":
            if is_detected:
                tp += 1
            else:
                fn += 1
                detailed_results.append(f"FN: {sample_id} ({item.get('description')}) - Risk: {risk_score}, Rules: {[r.name for r in matched_rules]}")
        else:  # benign
            if is_detected:
                fp += 1
                detailed_results.append(f"FP: {sample_id} ({item.get('description')}) - Risk: {risk_score}, Rules: {[r.name for r in matched_rules]}")
            else:
                tn += 1

    total_malicious = tp + fn
    total_benign = tn + fp

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / total_malicious if total_malicious > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / len(corpus)

    print("\n" + "=" * 64)
    print(" AgentShield Detection Benchmark Results (80-Sample Corpus)")
    print("=" * 64)
    print(f" Total Samples      : {len(corpus)} ({total_benign} Benign, {total_malicious} Malicious)")
    print(f" True Positives (TP): {tp} / {total_malicious}")
    print(f" False Positives(FP): {fp} / {total_benign}")
    print(f" True Negatives (TN): {tn} / {total_benign}")
    print(f" False Negatives(FN): {fn} / {total_malicious}")
    print("-" * 64)
    print(f" Accuracy           : {accuracy * 100:.2f}%")
    print(f" Precision          : {precision * 100:.2f}%")
    print(f" Recall             : {recall * 100:.2f}%")
    print(f" F1 Score           : {f1:.4f}")
    print("=" * 64)

    if detailed_results:
        print("\nMisclassifications:")
        for res in detailed_results:
            print(f" - {res}")

    # Strict performance assertions
    assert fp == 0, f"Expected 0 False Positives on benign set, but got {fp}"
    assert recall >= 0.95, f"Expected Recall >= 95.0% (>= 38/40), got {recall * 100:.1f}% ({tp}/{total_malicious})"
    assert precision == 1.0, f"Expected 100% precision, got {precision * 100:.1f}%"
