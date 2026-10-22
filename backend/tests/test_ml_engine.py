from app.services.ml_engine import ml_engine

def test_feature_extraction():
    action = {
        "action_type": "database_query",
        "parameters": {"query": "SELECT 1", "timeout": 30},
        "call_frequency": 25.0,
        "session_duration": 180.0,
    }
    features = ml_engine.extract_features(action)
    assert len(features) == 5
    assert isinstance(features[0], float)

def test_anomaly_score_range():
    action = {
        "action_type": "heartbeat_ok",
        "parameters": {},
        "call_frequency": 20.0,
        "session_duration": 60.0,
    }
    score = ml_engine.predict_anomaly_score(action)
    assert 0.0 <= score <= 1.0

def test_model_retrain():
    records = [
        {"action_type": "heartbeat_ok", "parameters": {}, "call_frequency": 10.0, "session_duration": 30.0}
        for _ in range(15)
    ]
    res = ml_engine.retrain(records)
    assert res["status"] == "retrained_successfully"
    assert res["sample_count"] == 15
