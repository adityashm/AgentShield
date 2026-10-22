import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgentShield AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database URL: defaults to local SQLite, easily overridden with PostgreSQL
    # Example PostgreSQL: postgresql://user:password@localhost:5432/agentshield
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./agentshield.db")
    
    # Security & Risk Thresholds (SRS FR-16 to FR-20)
    ALERT_RISK_THRESHOLD: float = 70.0
    ANOMALY_THRESHOLD: float = 0.70
    
    # JWT Authentication (SRS NFR-05)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "agentshield_secret_key_production_2026_imsec")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # ML Batch Evaluation Interval (seconds, SRS FR-12)
    ML_BATCH_INTERVAL_SECONDS: int = 60
    
    # Built-in Simulator Toggle (Disabled by default so server is purely real ingestion)
    AUTO_SIMULATE: bool = os.getenv("AUTO_SIMULATE", "false").lower() == "true"
    SIMULATOR_INTERVAL_SECONDS: float = 3.5

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")

settings = Settings()
