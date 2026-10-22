from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...database import get_db
from ...models import Action
from ...services.ml_engine import ml_engine

router = APIRouter(prefix="/model", tags=["model"])

@router.post("/retrain")
def retrain_model(db: Session = Depends(get_db)):
    """Trigger Isolation Forest model retraining on current action logs (SRS FR-14)."""
    # Fetch recent historical actions
    recent_actions = db.query(Action).order_by(Action.timestamp.desc()).limit(1000).all()
    action_dicts = [
        {
            "action_type": a.action_type,
            "parameters": a.parameters,
            "call_frequency": 20.0,
            "session_duration": 180.0,
        }
        for a in recent_actions
    ]
    result = ml_engine.retrain(action_dicts)
    return result

@router.get("/status")
def model_status():
    """Retrieve current Isolation Forest model status and parameters."""
    return {
        "is_trained": ml_engine.is_trained,
        "n_estimators": ml_engine.n_estimators,
        "contamination": ml_engine.contamination,
        "algorithm": "IsolationForest",
        "library": "scikit-learn",
    }
